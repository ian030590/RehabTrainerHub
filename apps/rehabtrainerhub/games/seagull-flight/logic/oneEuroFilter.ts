/**
 * Adapted from casiez/OneEuroFilter (JavaScript), Copyright 2019 Inria, by way of FlyingMoo (MIT).
 * BSD-3-Clause.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software
 *    without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
export class OneEuroFilter {
  private value: number | null = null;
  private derivative = 0;
  private lastTimeMs: number | null = null;
  private readonly minCutoffHz: number;
  private readonly beta: number;
  private readonly derivativeCutoffHz: number;

  constructor({ minCutoffHz = 3, beta = 2, derivativeCutoffHz = 1 } = {}) {
    if (![minCutoffHz, beta, derivativeCutoffHz].every(Number.isFinite) || minCutoffHz <= 0 || beta < 0 || derivativeCutoffHz <= 0) {
      throw new RangeError('Invalid One Euro filter parameters');
    }
    this.minCutoffHz = minCutoffHz;
    this.beta = beta;
    this.derivativeCutoffHz = derivativeCutoffHz;
  }

  reset() {
    this.value = null;
    this.derivative = 0;
    this.lastTimeMs = null;
  }

  filter(value: number, timeMs: number) {
    if (!Number.isFinite(value) || !Number.isFinite(timeMs)) throw new TypeError('Invalid filter sample');
    if (this.value === null || this.lastTimeMs === null) {
      this.value = value;
      this.lastTimeMs = timeMs;
      return value;
    }
    const dt = (timeMs - this.lastTimeMs) / 1000;
    if (dt <= 0) return this.value;
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    const velocity = (value - this.value) / dt;
    this.derivative += alpha(this.derivativeCutoffHz) * (velocity - this.derivative);
    const cutoff = this.minCutoffHz + this.beta * Math.abs(this.derivative);
    this.value += alpha(cutoff) * (value - this.value);
    this.lastTimeMs = timeMs;
    return this.value;
  }
}
