import type { TourStep } from '../runtime/tour';
import type { DrivingSettings } from '../settings';

export function GetDrivingTutorialSteps(language: string, mode: DrivingSettings['controlMode']): TourStep[] {
  const en = language === 'en';
  const controls = {
    arrow: en ? 'Use ↑ to accelerate, ↓ or Space to brake, and ← → to steer.' : '使用 ↑ 加速、↓ 或空白鍵煞車、← → 轉向。',
    wasd: en ? 'Use W to accelerate, S or Space to brake, and A D to steer.' : '使用 W 加速、S 或空白鍵煞車、A D 轉向。',
    wheel: en ? 'Use your calibrated wheel and pedals to steer, accelerate and brake.' : '使用已校正的方向盤及踏板轉向、加速與煞車。',
    touch: en ? 'Hold the on-screen accelerator or brake and drag the steering wheel to steer.' : '按住畫面上的油門或煞車，拖曳方向盤轉向。',
  };
  return [
    { target: '.driving-preview-hazard', title: en ? 'Watch the oncoming vehicle' : '注意逆行車輛',
      text: en ? 'Drive within your lane. Oncoming cars or scooters vary in colour. Each round starts when a vehicle begins crossing into your lane, rather than when it first appears.' : '控制車輛在車道內行駛，注意不同顏色的逆行汽車或機車。車輛開始跨越車道時才開始一回合，剛出現時還不計算反應時間。', place: 'bottom' },
    { target: '.driving-preview-controls', title: en ? 'Brake or steer to respond' : '煞車或轉向回應',
      text: controls[mode] + (en ? ' Reaction time ends at your first new brake or steering input after crossing starts. Controls already held do not count as a new response. Escape or Stop ends practice without saving an unfinished session.' : ' 跨越開始後，第一次新的煞車或左右轉向才算反應；持續按住的操作不算新反應。Escape 或停止可結束練習，未完成活動不保存。'), place: 'top' },
    { target: '.driving-preview-status', title: en ? 'Avoidance and results' : '閃避與成果',
      text: en ? 'Avoidance succeeds only after both vehicles fully pass without hitting the oncoming vehicle. On advanced difficulty, another vehicle collision during avoidance also fails the round. Unanswered rounds keep an empty reaction time; unfinished events have no outcome. Results show collisions, lane departures and frame rate. This practice does not determine real driving ability.' : '未撞到逆行車且雙方完全通過，才算成功閃避。高級難度在閃避期間撞到其他車也算失敗。沒有反應的回合保留空白反應時間；未完成事件不判定結果。成果顯示碰撞、偏離車道及畫面更新率；本練習不判定實際駕駛能力。', place: 'bottom' },
  ];
}
