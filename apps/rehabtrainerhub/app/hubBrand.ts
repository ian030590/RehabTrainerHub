export const hubName = 'Rehab Trainer Hub';
export const hubLocalName = '居家訓練網';
export const hubFullName = `${hubLocalName} ${hubName}`;
export const hubSearchAliases = ['trainerhub', 'trainerhub.cc'] as const;
export const hubAlternateNames = [hubName, hubFullName, ...hubSearchAliases] as const;
export const hubSeoDescriptor = '居家訓練工具與衛教資訊';
export const hubSeoTitle = `${hubLocalName}｜${hubSeoDescriptor}｜trainerhub.cc`;
