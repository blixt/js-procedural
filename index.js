// The top level procedural generator, useful for providing constants.
// This variable is assigned at the bottom of this module.
var global;

function procedural(name, parent) {
  var inputs = [], values = [];

  var lookup = {
    global: global,

    // Allows fetching based on a relative key path, e.g., "someParent.xyz".
    get: function (keyPath) {
      var keys = keyPath.split('.'), value = this;
      for (var i = 0; i < keys.length; i++) {
        value = value[keys[i]];
      }
      return value;
    },

    getInputs: function getInputs() {
      return inputs.map(function (input) { return input.name; });
    },

    getValues: function getValues() {
      return values.map(function (value) { return value.name; });
    },

    getName: function getName() {
      return name;
    },

    getParent: function getParent() {
      if (!parent) return null;
      return this[parent.getName()];
    },

    toString: function toString() {
      var args, obj = this, pieces = [];

      while (obj) {
        args = obj.getInputs().map(function (inputName) {
          return inputName + ': ' + JSON.stringify(obj[inputName]);
        });
        pieces.unshift(obj.getName() + '(' + args.join(', ') + ')');
        obj = obj.getParent();
      }

      return pieces.join('.');
    }
  };

  function create() {
    if (arguments.length != inputs.length) {
      var names = inputs.map(function (i) { return i.name; }).join(', ');
      throw new Error('Expected inputs for ' + name + ': ' + names);
    }

    // Ensure that the definition doesn't change after an instance has been created.
    if (!Object.isFrozen(create)) {
      Object.freeze(create);
      Object.freeze(lookup);
    }

    var instance = Object.create(lookup);
    if (parent) {
      instance[parent.getName()] = this;
    }

    var args = arguments;
    inputs.forEach(function (input, index) {
      var value = args[index];
      if (input.validator && !input.validator(instance, value)) {
        throw new Error('Invalid value for ' + name + '.' + input.name + ': ' + value);
      }
      instance[input.name] = value;
    });

    values.forEach(function (value) {
      instance[value.name] = value.fn ? value.fn(instance) : value.constant;
    });

    Object.freeze(instance);
    return instance;
  }

  create.done = function done() {
    return parent;
  };

  create.generates = function generates(nameValue) {
    if (Object.isFrozen(create)) {
      throw new Error('Cannot define ' + this + '.' + nameValue + ': instances of ' + name + ' exist');
    }

    var proc = procedural(nameValue, this);
    lookup[nameValue] = proc;
    this[nameValue] = proc;

    return proc;
  };

  create.getName = function getName() {
    return name;
  };

  create.getParent = function getParent() {
    return parent;
  };

  create.toString = function toString() {
    var pieces = [], proc = this;
    while (proc) {
      pieces.unshift(proc.getName());
      proc = proc.getParent();
    }
    return pieces.join('.');
  };

  // Utility function that will create a dynamic value based on hashing the specified key paths.
  create.withHashFrom = function withHashFrom(var_args) {
    var args = arguments;
    return this.withValue('hash', function (proc) {
      var values = Array.prototype.map.call(args, proc.get, proc),
          initialHash = values.shift();
      return procedural.fnv(initialHash, values.join('\x00'));
    });
  };

  create.withInput = function withInput(name, validator) {
    if (Object.isFrozen(create)) {
      throw new Error('Cannot define input after creation');
    }

    var input = {name: name};
    if (typeof validator == 'function') {
      input.validator = validator;
    }
    inputs.push(input);
    return this;
  };

  create.withValue = function withValue(name, fnOrConstant) {
    if (Object.isFrozen(create)) {
      throw new Error('Cannot define value after creation');
    }

    var value = {name: name};
    if (typeof fnOrConstant == 'function') {
      value.fn = fnOrConstant;
    } else {
      value.constant = fnOrConstant;
    }
    values.push(value);

    return this;
  };

  create.withInputs = function withInputs() {
    Array.prototype.forEach.call(arguments, this.withInput, this);
    return this;
  };

  return create;
}

/**
 * A 32-bit Fowler–Noll–Vo hash function.
 * http://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 *
 * Takes an initial hash, then a string to hash.
 */
procedural.fnv = function fnv(hash, string) {
  for (var i = 0; i < string.length; i++) {
    // FNV-1a implementation.
    hash ^= string.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
};

// The base hash for 32-bit FNV hashes.
procedural.fnv.offsetBasis = 2166136261;

// Set up the global object.
global = procedural('global', null).withValue('baseHash', procedural.fnv.offsetBasis)();

// TODO: Don't support direct use from <script> tags.
if (window.module) module.exports = procedural;
