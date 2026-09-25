using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace TobiiEyeTrainer;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var address = args.Length > 0 ? args[0] : "https://trainerhub.cc/games/oculomotor-training/";
        if (!Uri.TryCreate(address, UriKind.Absolute, out var url)
            || url.AbsolutePath != "/games/oculomotor-training/"
            || !(url.Scheme == "https" && url.Host == "trainerhub.cc"
                || url.Scheme == "http" && (url.Host == "localhost" || url.Host == "127.0.0.1")))
        {
            MessageBox.Show("Only the oculomotor game on trainerhub.cc or local development is allowed.");
            return;
        }
        Application.Run(new EyeTrackerHost(url));
    }
}

internal sealed class EyeTrackerHost : Form
{
    private readonly Uri _gameUrl;
    private readonly TobiiDevice _device = new();
    private readonly WebView2 _view = new() { Dock = DockStyle.Fill };

    public EyeTrackerHost(Uri gameUrl)
    {
        _gameUrl = gameUrl;
        Text = "居家訓練網｜Tobii Eye Tracker 5";
        FormBorderStyle = FormBorderStyle.None;
        WindowState = FormWindowState.Maximized;
        Controls.Add(_view);
        Load += OnLoaded;
        FormClosed += (_, _) => _device.Dispose();
    }

    private async void OnLoaded(object? sender, EventArgs e)
    {
        if (!_device.Start(allowSimulatorFallback: false) || _device.IsSimulator)
        {
            MessageBox.Show("Tobii Eye Tracker 5 is unavailable. Check Tobii Experience and tobii_stream_engine.dll.");
            Close();
            return;
        }

        try
        {
            await _view.EnsureCoreWebView2Async();
            var core = _view.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsWebMessageEnabled = true;
            core.NavigationStarting += (_, args) =>
            {
                if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var next)
                    || next.GetLeftPart(UriPartial.Authority) != _gameUrl.GetLeftPart(UriPartial.Authority)
                    || !next.AbsolutePath.StartsWith("/games/oculomotor-training/", StringComparison.Ordinal))
                    args.Cancel = true;
            };
            core.NewWindowRequested += (_, args) => args.Handled = true;
            await core.AddScriptToExecuteOnDocumentCreatedAsync("window.__rehabTobiiHost = true;");
            _device.GazeReceived += OnGaze;
            core.Navigate(_gameUrl.ToString());
        }
        catch (Exception error)
        {
            MessageBox.Show($"WebView2 could not start: {error.Message}");
            Close();
        }
    }

    private void OnGaze(object? sender, GazeSampleEventArgs sample)
    {
        if (IsDisposed || !_view.IsHandleCreated) return;
        try
        {
            BeginInvoke(() =>
            {
                if (IsDisposed || _view.CoreWebView2 is null) return;
                _view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new
                {
                    type = "gaze",
                    x = float.IsFinite(sample.X) ? sample.X : 0,
                    y = float.IsFinite(sample.Y) ? sample.Y : 0,
                    valid = sample.Valid && float.IsFinite(sample.X) && float.IsFinite(sample.Y),
                    deviceTimestampMicroseconds = sample.TimestampUs,
                }));
            });
        }
        catch (InvalidOperationException) { }
    }
}
