var murmur3 = require('./lib/murmur3');
var random = require('./lib/random');

// Poor man's enum.
var PARAMETER = {}, COMPUTED = {};

// Allows fetching based on a relative key path, e.g., "someParent.xyz". For
// traversing up the tree, "..parentValue" and "...grandParentValue" also
// works, as well as "/rootValue".
function instanceGet(keyPath) {
  var value = this;
  // Make key path relative to root node if first character is "/".
  if (keyPath[0] == '/') {
    var parent;
    while (parent = value.getParent()) value = parent;
    keyPath = keyPath.substr(1);
  }
  var keys = keyPath.split('.');

  // Remove first empty argument to make ".bla" refer to current instance.
  if (!keys[0]) {
    keys.shift();
  }

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    value = key ? value[key] : value.getParent();
  }
  return value;
}

module.exports = function procedural(name, parent) {
  var values = [], valuesMap = {hash: null};
  var doNotHash = [];
  var parameterCount = 0;

  // Prevent defining values with the same name as the parent.
  if (parent) {
    valuesMap[parent.getName()] = null;
  }

  // Utility functions that can be passed for use outside this function.
  function getName() {
    return name;
  }

  function getValues(opt_type) {
    var names = [];
    for (var i = 0; i < values.length; i++) {
      if (opt_type && values[i].type != opt_type) continue;
      names.push(values[i].name);
    }
    return names;
  }

  function getParameters() {
    return getValues(PARAMETER);
  }

  function getProvides() {
    return getValues(COMPUTED);
  }

  // The constructor for a single instance of this procedural function.
  function ProceduralInstance(parentInstance) {
    if (parentInstance) {
      this[parentInstance.getName()] = parentInstance;
    } else if (parent) {
      console.warn('Creating detached ' + name + ' instance (expected parent ' + parent + ')');
    }
  }

  ProceduralInstance.prototype = {
    get: instanceGet,
    getName: getName,
    getParameters: getParameters,
    getProvides: getProvides,
    getValues: getValues,

    getParent: function () {
      if (!parent) return null;
      return this[parent.getName()];
    },

    getRandGen: function (opt_id) {
      var p = this.getParent(),
          s0 = murmur3.hash32(opt_id || 'default', this.hash) * 2.3283064365386963e-10,
          s1 = this.hash * 2.3283064365386963e-10;
      return random(s0, s1);
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
    if (arguments.length != parameterCount) {
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
    var parentInstance = parent && parent.isInstance(this) ? this : null;

    // Create the instance which will hold all the values.
    var instance = new ProceduralInstance(parentInstance);

    // Start setting up an array of all values that make up the hash.
    var hashParts = [name], hashSeed = parentInstance ? parentInstance.hash : 0;
    function createHashOnce() {
      if ('hash' in instance) return;
      // Calculate the hash for the instance based on parents and parameters.
      instance.hash = murmur3.hash32(hashParts.join('\x00'), hashSeed);
    }

    // Fill in all the values specified on this procedural function.
    var argumentIndex = 0;
    for (var i = 0; i < values.length; i++) {
      var value = values[i], shouldHash = doNotHash.indexOf(value.name) == -1;

      if (value.type == PARAMETER) {
        if ('hash' in instance && shouldHash) {
          throw new Error('Cannot define hashed parameters after hash is generated');
        }

        var argument = arguments[argumentIndex++];

        // Validate the value.
        if (value.validator && !value.validator(instance, argument)) {
          throw new Error('Invalid value for ' + name + '.' + value.name + ': ' + argument);
        }

        // Assign the argument value to the instance.
        instance[value.name] = argument;

        if (shouldHash) {
          // TODO: Performance check for JSON.stringify, maybe toString is enough.
          hashParts.push(JSON.stringify(instance[value.name]));
        }
      } else if (value.type == COMPUTED) {
        // Compute and assign the value to the instance.
        if (value.fn) {
          // Always create the hash before computing values which may need it.
          createHashOnce();
          instance[value.name] = value.fn(instance);
        } else {
          instance[value.name] = value.constant;
        }
      }
    }

    // Create the hash now if it wasn't created above.
    createHashOnce();

    // Prevent the instance from changing before exposing it.
    Object.freeze(instance);
    return instance;
  }

  create.getName = getName;
  create.getParameters = getParameters;
  create.getProvides = getProvides;
  create.getValues = getValues;

  create.done = function () {
    return parent;
  };

  create.doNotHash = function (var_args) {
    Array.prototype.push.apply(doNotHash, arguments);
    return this;
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

  create.getParent = function () {
    return parent;
  };

  create.isInstance = function (obj) {
    return obj instanceof ProceduralInstance;
  };

  create.provides = function (name, fnOrConstant) {
    /*
    if (Object.isFrozen(create)) {
      throw new Error('Cannot define value after creation');
    }
    */

    if (name in valuesMap) {
      throw new Error('A value named ' + name + ' is already defined');
    }

    if (name in ProceduralInstance.prototype) {
      throw new Error('Invalid value name "' + name + '"');
    }

    var value = {name: name, type: COMPUTED};
    if (typeof fnOrConstant == 'function') {
      value.fn = fnOrConstant;
    } else {
      value.constant = fnOrConstant;
    }
    values.push(value);
    valuesMap[name] = value;

    return this;
  };

  create.providesMethod = function (name, fn) {
    if (typeof fn != 'function') {
      throw new Error('Method must be passed in as a function');
    }

    if (name in valuesMap) {
      throw new Error('A value named ' + name + ' is already defined');
    }

    if (name in ProceduralInstance.prototype) {
      throw new Error('Invalid method name "' + name + '"');
    }

    valuesMap[name] = function wrapper() {
      return fn.apply(this, Array.prototype.concat.apply([this], arguments));
    };
    ProceduralInstance.prototype[name] = valuesMap[name];

    return this;
  };

  create.takes = function (var_args) {
    /*
    if (Object.isFrozen(create)) {
      throw new Error('Cannot define parameter after creation');
    }
    */

    // The last argument may be a validation function.
    var numParams = arguments.length, validator;
    if (typeof arguments[numParams - 1] == 'function') {
      validator = arguments[numParams--];
    }

    if (!numParams) {
      throw new Error('At least one parameter must be specified');
    }

    for (var i = 0; i < numParams; i++) {
      var name = arguments[i];

      if (typeof name != 'string') {
        throw new Error('Invalid parameter name ' + name);
      }

      if (name in valuesMap) {
        throw new Error('A value named ' + name + ' is already defined');
      }

      if (name in ProceduralInstance.prototype) {
        throw new Error('Invalid parameter name "' + name + '"');
      }

      var param = {name: name, type: PARAMETER};
      if (typeof validator == 'function') {
        param.validator = validator;
      }
      values.push(param);
      valuesMap[name] = param;
    }

    // Keep track of number of parameters for the constructor validation.
    parameterCount += numParams;

    return this;
  };

  create.toString = function () {
    var pieces = [], proc = this;
    while (proc) {
      pieces.unshift(proc.getName());
      proc = proc.getParent();
    }

    var names = this.getParameters().join(', ');
    return pieces.join('.') + '(' + names + ')';
  };

  return create;
};
