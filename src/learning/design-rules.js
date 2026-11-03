export function designRule(name, data, config) {
  const field = data.fields?.find(item => item.id === config.color?.field);
  const rules = {
    scatter: () => config.kind === 'scatter',
    distribution: () => config.kind === 'histogram',
    box: () => config.kind === 'box' && config.grouped,
    categorical: () => config.color?.schemeType === 'categorical' && field?.type === 'nominal',
    sequential: () => config.color?.schemeType === 'sequential' && field?.type === 'quantitative',
    diverging: () => config.color?.schemeType === 'diverging' && config.color.field === 'difference' && config.color.midpoint === 0,
    flat: () => config.kind === 'bar' && config.presentation === '2d',
    context: () => config.kind === 'line',
    dual: () => config.kind === 'line' && ['dual','small-multiples','indexed'].includes(config.presentation),
    'distribution-redesign': () => config.kind === 'histogram' || config.kind === 'box' && config.grouped,
  };
  return rules[name]?.() ?? false;
}
