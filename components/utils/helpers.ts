export function mapRssiToProgress(value: number): number {
  const minInput = -100;
  const maxInput = 0;
  const minOutput = 0;
  const maxOutput = 1;

  const mappedValue = (value - minInput) / (maxInput - minInput);
  const mappedFloat = mappedValue * (maxOutput - minOutput) + minOutput;
  const roundedFloat = Math.round(mappedFloat * 10) / 10;

  return roundedFloat;
}
