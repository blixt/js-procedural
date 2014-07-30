// TODO:
// - Store parameters + computed values in same list to preserve order
// - perlin noise
// - allow for specifying what parameters affect the hash


/**
 * Creates a pseudo-random value generator. The seed must be an integer.
 *
 * Uses an optimized version of the Park-Miller PRNG.
 * http://www.firstpr.com.au/dsp/rand31/
 */
function Random(seed) {
  this._seed = seed % 2147483647;
  if (this._seed <= 0) this._seed += 2147483646;
}

/**
 * Returns a pseudo-random value between 1 and 2^32 - 2.
 */
Random.prototype.next = function () {
  return this._seed = this._seed * 16807 % 2147483647;
};

/**
 * Returns a pseudo-random floating point number in range [0, 1), or a custom
 * range, if specified. The lower bound is inclusive while the upper bound is
 * exclusive.
 */
Random.prototype.nextFloat = function (opt_minOrMax, opt_max) {
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
Random.prototype.nextInt = function (minOrMax, opt_max) {
  return Math.floor(this.nextFloat(minOrMax, opt_max));
};

function procedural(name, parent) {
  var params = [], values = [];

  function ProceduralInstance(parentInstance) {
    if (parentInstance) {
      this[parentInstance.getName()] = parentInstance;
    } else if (parent) {
      console.warn('Creating detached instance (expected parent ' + parent + ')');
    }
  }

  ProceduralInstance.prototype = {
    // Allows fetching based on a relative key path, e.g., "someParent.xyz".
    get: function (keyPath) {
      var keys = keyPath.split('.'), value = this;
      for (var i = 0; i < keys.length; i++) {
        value = value[keys[i]];
      }
      return value;
    },

    getParameters: function () {
      return params.map(function (param) { return param.name; });
    },

    getRandGen: function (opt_id) {
      var seed = opt_id ? murmurhash3(opt_id, this.hash) : this.hash;
      return new Random(seed);
    },

    getValues: function () {
      return values.map(function (value) { return value.name; });
    },

    getName: function () {
      return name;
    },

    getParent: function () {
      if (!parent) return null;
      return this[parent.getName()];
    },

    toString: function () {
      var args, proc = this, pieces = [];

      while (proc) {
        args = proc.getParameters().map(function (paramName) {
          return paramName + ': ' + JSON.stringify(proc[paramName]);
        });
        pieces.unshift(proc.getName() + '(' + args.join(', ') + ')');
        proc = proc.getParent();
      }

      return pieces.join('.');
    }
  };

  function create() {
    if (arguments.length != params.length) {
      throw new Error('Wrong number of parameters for ' + create + ': ' + arguments.length);
    }

    /*
    // Ensure that the definition doesn't change after an instance has been created.
    if (!Object.isFrozen(create)) {
      Object.freeze(create);
      Object.freeze(ProceduralInstance.prototype);
    }
    */

    // We assume that this function is bound to the parent instance. Example:
    // jupiter.moon(13) -- "moon" is this function, bound to "jupiter".
    var parentInstance = this.getName ? this : null;

    // Create the instance which will hold all the values.
    var instance = new ProceduralInstance(parentInstance);

    // Start setting up an array of all hash parameter pieces.
    var hashParams = [name];

    // Map all the arguments to the registered parameters.
    for (var i = 0; i < params.length; i++) {
      var param = params[i], value = arguments[i];

      // Validate the value.
      if (param.validator && !param.validator(instance, value)) {
        throw new Error('Invalid value for ' + name + '.' + param.name + ': ' + value);
      }

      instance[param.name] = value;
      // TODO: Performance check for JSON.stringify, maybe toString is enough.
      hashParams.push(JSON.stringify(instance[param.name]));
    }

    // Calculate the hash for the instance based on parents and parameters.
    // TODO: This probably needs to allow customization of hashing.
    var hashSeed = parentInstance ? parentInstance.hash : 0;
    instance.hash = murmurhash3(hashParams.join('\x00'), hashSeed);

    // Set all the computed values on the instance.
    for (var i = 0; i < values.length; i++) {
      var value = values[i];
      instance[value.name] = value.fn ? value.fn(instance) : value.constant;
    }

    // Prevent the instance from changing before exposing it.
    Object.freeze(instance);
    return instance;
  }

  create.done = function () {
    return parent;
  };

  create.generates = function (nameValue) {
    /*
    if (Object.isFrozen(create)) {
      throw new Error('Cannot define ' + this + '.' + nameValue + ': instances of ' + name + ' exist');
    }
    */

    var proc = procedural(nameValue, this);
    ProceduralInstance.prototype[nameValue] = proc;
    this[nameValue] = proc;

    return proc;
  };

  create.getName = function () {
    return name;
  };

  create.getParent = function () {
    return parent;
  };

  create.provides = function (name, fnOrConstant) {
    /*
    if (Object.isFrozen(create)) {
      throw new Error('Cannot define value after creation');
    }
    */

    var value = {name: name};
    if (typeof fnOrConstant == 'function') {
      value.fn = fnOrConstant;
    } else {
      value.constant = fnOrConstant;
    }
    values.push(value);

    return this;
  };

  create.takes = function (var_args) {
    /*
    if (Object.isFrozen(create)) {
      throw new Error('Cannot define parameter after creation');
    }
    */

    var numParams = arguments.length, validator;
    if (typeof arguments[numParams - 1] == 'function') {
      validator = numParams--;
    }

    if (!numParams) {
      throw new Error('At least one parameter must be specified');
    }

    for (var i = 0; i < numParams; i++) {
      var name = arguments[i];
      if (typeof name != 'string') {
        throw new Error('Invalid parameter name ' + name);
      }
      var param = {name: name};
      if (typeof validator == 'function') {
        param.validator = validator;
      }
      params.push(param);
    }

    return this;
  };

  create.toString = function () {
    var pieces = [], proc = this;
    while (proc) {
      pieces.unshift(proc.getName());
      proc = proc.getParent();
    }

    var names = params.map(function (param) { return param.name; }).join(', ');
    return pieces.join('.') + '(' + names + ')';
  };

  return create;
}

// TODO: Don't support direct use from <script> tags.
if (window.module) module.exports = procedural;
