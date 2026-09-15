export function softmax(values) {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

export function trainLogits(logits, targetIndex, step = 0.28) {
  return logits.map((logit, index) =>
    index === targetIndex ? logit + step : logit
  );
}
