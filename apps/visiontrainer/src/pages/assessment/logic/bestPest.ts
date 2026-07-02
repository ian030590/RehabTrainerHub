/**
 * BestPEST adaptive threshold algorithm.
 * Ported from FrACT10's ThresholderPest.j (© Michael Bach).
 *
 * Operates on a normalised 0…1 stimulus scale.
 * 0 = hardest (smallest optotype), 1 = easiest (largest optotype).
 */

export class BestPEST {
  private readonly kRange: number;
  private readonly kRange1: number;
  private readonly kRange2: number;
  private readonly probability: Float64Array;
  private readonly plgit: Float64Array;
  private readonly mlgit: Float64Array;
  private appliedStimStored = 0;
  private wasCorrectStored = false;

  constructor(numAlternatives: number) {
    this.kRange = 5000;
    this.kRange1 = this.kRange - 1;
    this.kRange2 = this.kRange * 2;

    this.probability = new Float64Array(this.kRange);
    this.plgit = new Float64Array(this.kRange2);
    this.mlgit = new Float64Array(this.kRange2);

    // Slope controls the steepness of the psychometric function
    const slope = this.kRange / 10.0;
    const guessProb = 1.0 / numAlternatives;

    for (let i = 0; i < this.kRange2; i++) {
      const logistic =
        guessProb +
        (1.0 - guessProb) / (1.0 + Math.exp((this.kRange - i) / slope));
      this.plgit[i] = Math.log10(logistic);
      this.mlgit[i] = Math.log10(1.0 - logistic);
    }

    // Prime the algorithm with two boundary trials
    this.enterTrialOutcome(0.0, false);
    this.nextStim2apply();
    this.enterTrialOutcome(1.0, true);
  }

  /**
   * Record the outcome of a trial.
   * @param appliedStim – The stimulus value that was actually presented (0…1)
   * @param wasCorrect – Whether the observer responded correctly
   */
  enterTrialOutcome(appliedStim: number, wasCorrect: boolean): void {
    this.appliedStimStored = Math.max(0, Math.min(1, appliedStim));
    this.wasCorrectStored = wasCorrect;
  }

  /**
   * Compute the next stimulus value to present (0…1).
   */
  nextStim2apply(): number {
    return this.nextStimGiven(this.appliedStimStored, this.wasCorrectStored);
  }

  private nextStimGiven(appliedStim: number, wasCorrect: boolean): number {
    const intStim = this.ext2int(appliedStim);
    let p1 = -10000;
    let p2 = -10000;
    let maxP = -10000;

    for (let i = 0; i < this.kRange; i++) {
      let ii = this.kRange + intStim - i;
      if (ii < 0) ii = 0;
      if (ii >= this.kRange2) ii = this.kRange2 - 1;

      const p =
        this.probability[i] +
        (wasCorrect ? this.plgit[ii] : this.mlgit[ii]);

      if (p > maxP) {
        maxP = p;
        p1 = i;
      }
      if (p === maxP) {
        p2 = i;
      }
      this.probability[i] = p;
    }

    const internalStim = Math.round((p1 + p2) / 2);
    return this.int2ext(internalStim);
  }

  private ext2int(extStim: number): number {
    const iTemp = Math.round(extStim * this.kRange1);
    return Math.min(Math.max(iTemp, 0), this.kRange - 1);
  }

  private int2ext(intStim: number): number {
    return intStim / this.kRange1;
  }
}
