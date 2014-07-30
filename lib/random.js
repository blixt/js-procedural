/**
 * Creates a pseudo-random value generator. The seed must be an integer.
 *
 * Uses an optimized version of the Park-Miller PRNG.
 * http://www.firstpr.com.au/dsp/rand31/
 */
function ParkMiller(seed) {
  this._seed = seed % 2147483647;
  if (this._seed <= 0) this._seed += 2147483646;
}

/**
 * Returns a pseudo-random value between 1 and 2^32 - 2.
 */
ParkMiller.prototype.next = function () {
  return this._seed = this._seed * 16807 % 2147483647;
};

/**
 * Returns a pseudo-random floating point number in range [0, 1), or a custom
 * range, if specified. The lower bound is inclusive while the upper bound is
 * exclusive.
 */
ParkMiller.prototype.nextFloat = function (opt_minOrMax, opt_max) {
  // We know that result of next() will be 1 to 2147483646 (inclusive).
  var value = (this.next() - 1) / 2147483646;

  var min, max;
  if (typeof opt_max == 'number') {
    min = opt_minOrMax;
    max = opt_max;
  } else if (typeof opt_minOrMax == 'number') {
    min = 0;
    max = opt_minOrMax;
  } else {
    return value;
  }

  return min + value * (max - min);
};

/**
 * Returns a pseudo-random integer in the specified range. The lower bound is
 * inclusive while the upper bound is exclusive.
 */
ParkMiller.prototype.nextInt = function (minOrMax, opt_max) {
  return Math.floor(this.nextFloat(minOrMax, opt_max));
};

exports.ParkMiller = ParkMiller;
