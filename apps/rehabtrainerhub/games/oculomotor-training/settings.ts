export type OculomotorSettings = Record<string, string | number | boolean>;
export interface SettingField {
  key: string; type: string; label: Record<string, string>; default: string | number | boolean;
  min?: number; max?: number; step?: number; unit?: Record<string, string>;
  options?: { value: string; label: Record<string, string> }[];
}
export interface SettingSection { id: string; title: Record<string, string>; description?: Record<string, string>; fields: SettingField[] }
export const settingsSections: SettingSection[] = [
  {
    "id": "display",
    "title": {
      "zh-TW": "螢幕與攝影機",
      "en": "Display and camera"
    },
    "description": {
      "zh-TW": "請輸入可視螢幕尺寸與觀看距離。攝影機眼動追蹤需在 HTTPS 或 localhost 授權；不使用 Tobii 裝置。",
      "en": "Enter the visible screen size and viewing distance. Camera tracking requires permission on HTTPS or localhost."
    },
    "fields": [
      {
        "key": "screenWidthCm",
        "type": "number",
        "label": {
          "zh-TW": "可視螢幕寬度",
          "en": "Visible screen width"
        },
        "default": 53,
        "min": 0,
        "step": 0.1,
        "unit": {
          "zh-TW": "公分",
          "en": "cm"
        }
      },
      {
        "key": "screenHeightCm",
        "type": "number",
        "label": {
          "zh-TW": "可視螢幕高度",
          "en": "Visible screen height"
        },
        "default": 30,
        "min": 0,
        "step": 0.1,
        "unit": {
          "zh-TW": "公分",
          "en": "cm"
        }
      },
      {
        "key": "viewingDistanceCm",
        "type": "number",
        "label": {
          "zh-TW": "觀看距離",
          "en": "Viewing distance"
        },
        "default": 60,
        "min": 0,
        "step": 0.1,
        "unit": {
          "zh-TW": "公分",
          "en": "cm"
        }
      },
      {
        "key": "eyeTrackingSource",
        "type": "list",
        "label": {
          "zh-TW": "眼動來源",
          "en": "Gaze source"
        },
        "default": "webgazer",
        "options": [
          {
            "value": "webgazer",
            "label": {
              "zh-TW": "WebGazer 攝影機",
              "en": "WebGazer camera"
            }
          },
          {
            "value": "off",
            "label": {
              "zh-TW": "不記錄眼動",
              "en": "No gaze tracking"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "protocol",
    "title": {
      "zh-TW": "實驗程序",
      "en": "Experiment protocol"
    },
    "description": {
      "zh-TW": "保留參考專案的四種實驗、評估／可預測／隨機節奏與目標樣式。VOR 不使用節奏與目標樣式選項。",
      "en": "The four reference drills, evaluation/predictable/random pacing, and target styles. VOR ignores pacing and style."
    },
    "fields": [
      {
        "key": "module",
        "type": "list",
        "label": {
          "zh-TW": "活動",
          "en": "Drill"
        },
        "default": "pursuit",
        "options": [
          {
            "value": "vor",
            "label": {
              "zh-TW": "中央目標辨識",
              "en": "Central target recognition"
            }
          },
          {
            "value": "pursuit",
            "label": {
              "zh-TW": "追視",
              "en": "Smooth pursuit"
            }
          },
          {
            "value": "saccade",
            "label": {
              "zh-TW": "跳視",
              "en": "Saccade"
            }
          },
          {
            "value": "fixation",
            "label": {
              "zh-TW": "定點注視",
              "en": "Fixation"
            }
          }
        ]
      },
      {
        "key": "testMode",
        "type": "list",
        "label": {
          "zh-TW": "測試節奏",
          "en": "Test mode"
        },
        "default": "predictable",
        "options": [
          {
            "value": "evaluation",
            "label": {
              "zh-TW": "評估：固定次數",
              "en": "Evaluation: fixed targets"
            }
          },
          {
            "value": "predictable",
            "label": {
              "zh-TW": "可預測循環",
              "en": "Predictable cycle"
            }
          },
          {
            "value": "random",
            "label": {
              "zh-TW": "隨機且不連續重複",
              "en": "Random without immediate repeat"
            }
          }
        ]
      },
      {
        "key": "stimulusType",
        "type": "list",
        "label": {
          "zh-TW": "目標樣式",
          "en": "Target style"
        },
        "default": "white_dot",
        "options": [
          {
            "value": "white_dot",
            "label": {
              "zh-TW": "白點",
              "en": "White dot"
            }
          },
          {
            "value": "red_in_white",
            "label": {
              "zh-TW": "白圈紅心",
              "en": "Red in white"
            }
          },
          {
            "value": "numbers_dot",
            "label": {
              "zh-TW": "變色數字",
              "en": "Colored number"
            }
          }
        ]
      },
      {
        "key": "ballArcmin",
        "type": "slider",
        "label": {
          "zh-TW": "目標視角",
          "en": "Target visual angle"
        },
        "default": 60,
        "min": 1,
        "max": 600,
        "step": 1,
        "unit": {
          "zh-TW": "角分",
          "en": "arcmin"
        }
      },
      {
        "key": "distanceThresholdArcmin",
        "type": "slider",
        "label": {
          "zh-TW": "命中距離閾值",
          "en": "Hit distance threshold"
        },
        "default": 90,
        "min": 10,
        "max": 600,
        "step": 1,
        "unit": {
          "zh-TW": "角分",
          "en": "arcmin"
        }
      }
    ]
  },
  {
    "id": "timing",
    "title": {
      "zh-TW": "各活動時間與速度",
      "en": "Drill timing and speed"
    },
    "description": {
      "zh-TW": "只套用所選活動的時間參數；評估節奏以參考專案的目標數自動結束。",
      "en": "Only the selected drill’s timing applies. Evaluation ends after the reference target count."
    },
    "fields": [
      {
        "key": "vorTotalSec",
        "type": "number",
        "label": {
          "zh-TW": "中央辨識總時間",
          "en": "Central recognition duration"
        },
        "default": 30,
        "min": 0,
        "step": 0.1,
        "unit": {
          "zh-TW": "秒",
          "en": "s"
        }
      },
      {
        "key": "pursuitTotalSec",
        "type": "number",
        "label": {
          "zh-TW": "追視總時間",
          "en": "Pursuit duration"
        },
        "default": 45,
        "min": 0,
        "step": 0.1,
        "unit": {
          "zh-TW": "秒",
          "en": "s"
        }
      },
      {
        "key": "saccadeTotalSec",
        "type": "number",
        "label": {
          "zh-TW": "跳視總時間",
          "en": "Saccade duration"
        },
        "default": 45,
        "min": 0,
        "step": 0.1,
        "unit": {
          "zh-TW": "秒",
          "en": "s"
        }
      },
      {
        "key": "fixationTotalSec",
        "type": "number",
        "label": {
          "zh-TW": "定點注視總時間",
          "en": "Fixation duration"
        },
        "default": 60,
        "min": 0,
        "step": 0.1,
        "unit": {
          "zh-TW": "秒",
          "en": "s"
        }
      },
      {
        "key": "changeMs",
        "type": "number",
        "label": {
          "zh-TW": "中央目標變化間隔",
          "en": "Central target change interval"
        },
        "default": 500,
        "min": 0,
        "step": 1,
        "unit": {
          "zh-TW": "毫秒",
          "en": "ms"
        }
      },
      {
        "key": "speedArcminSec",
        "type": "number",
        "label": {
          "zh-TW": "追視與定點移動速度",
          "en": "Pursuit and fixation speed"
        },
        "default": 300,
        "min": 0,
        "step": 0.1,
        "unit": {
          "zh-TW": "角分／秒",
          "en": "arcmin/s"
        }
      },
      {
        "key": "dwellMs",
        "type": "number",
        "label": {
          "zh-TW": "跳視停留時間",
          "en": "Saccade target dwell"
        },
        "default": 500,
        "min": 0,
        "step": 1,
        "unit": {
          "zh-TW": "毫秒",
          "en": "ms"
        }
      },
      {
        "key": "holdSec",
        "type": "number",
        "label": {
          "zh-TW": "定點邊緣停留",
          "en": "Fixation edge hold"
        },
        "default": 2,
        "min": 0,
        "step": 0.1,
        "unit": {
          "zh-TW": "秒",
          "en": "s"
        }
      }
    ]
  },
  {
    "id": "directions",
    "title": {
      "zh-TW": "移動方位",
      "en": "Movement directions"
    },
    "description": {
      "zh-TW": "參考專案的八個方位。中央辨識不使用此設定。",
      "en": "The reference project’s eight directions. Central recognition ignores these."
    },
    "fields": [
      {
        "key": "axis0Enabled",
        "type": "checkbox",
        "label": {
          "zh-TW": "上",
          "en": "Up"
        },
        "default": true
      },
      {
        "key": "axis1Enabled",
        "type": "checkbox",
        "label": {
          "zh-TW": "右上",
          "en": "Top right"
        },
        "default": true
      },
      {
        "key": "axis2Enabled",
        "type": "checkbox",
        "label": {
          "zh-TW": "右",
          "en": "Right"
        },
        "default": true
      },
      {
        "key": "axis3Enabled",
        "type": "checkbox",
        "label": {
          "zh-TW": "右下",
          "en": "Bottom right"
        },
        "default": true
      },
      {
        "key": "axis4Enabled",
        "type": "checkbox",
        "label": {
          "zh-TW": "下",
          "en": "Down"
        },
        "default": true
      },
      {
        "key": "axis5Enabled",
        "type": "checkbox",
        "label": {
          "zh-TW": "左下",
          "en": "Bottom left"
        },
        "default": true
      },
      {
        "key": "axis6Enabled",
        "type": "checkbox",
        "label": {
          "zh-TW": "左",
          "en": "Left"
        },
        "default": true
      },
      {
        "key": "axis7Enabled",
        "type": "checkbox",
        "label": {
          "zh-TW": "左上",
          "en": "Top left"
        },
        "default": true
      }
    ]
  }
];
export const defaultSettings: OculomotorSettings = Object.fromEntries(settingsSections.flatMap(section => section.fields).map(field => [field.key, field.default]));
export function GetActiveSettingFields(settings: OculomotorSettings) {
  const module = String(settings.module);
  const visible = new Set(['screenWidthCm', 'screenHeightCm', 'viewingDistanceCm', 'eyeTrackingSource', 'module', 'ballArcmin', 'distanceThresholdArcmin', `${module}TotalSec`,
    ...(module === 'vor' ? ['changeMs'] : ['testMode', 'stimulusType', ...Array.from({ length: 8 }, (_, index) => `axis${index}Enabled`)]),
    ...(['pursuit', 'fixation'].includes(module) ? ['speedArcminSec'] : []),
    ...(module === 'fixation' ? ['holdSec'] : []), ...(module === 'saccade' ? ['dwellMs'] : [])]);
  return settingsSections.flatMap(section => section.fields).filter(field => visible.has(field.key));
}
export function ValidateSettings(settings: OculomotorSettings) {
  return settingsSections.flatMap(section => section.fields).every(field => {
    const value = settings[field.key];
    if (field.type === 'checkbox') return typeof value === 'boolean';
    if (field.type === 'list') return field.options?.some(option => option.value === value);
    return typeof value === 'number' && Number.isFinite(value) && (field.type === 'number' ? value > 0 : value >= field.min!) && value <= (field.max ?? 1e9)
      && (!field.key.endsWith('TotalSec') || value <= 1200);
  }) && (settings.module === 'vor' || Array.from({ length: 8 }, (_, index) => settings[`axis${index}Enabled`]).some(value => value === true));
}
