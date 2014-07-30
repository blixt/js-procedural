procedural
==========

Library for defining procedural functions in a hierarchy to allow for complex
procedurally generated content.


Introduction
------------

This library aims to make it easy to create procedurally generated content,
which usually means semi-random content that follows a complex set of rules.
One great example of procedural generated content is the world in Minecraft.
It's random for everyone who starts the game, but follows certain rules that
together make a recognizable environment (hills, trees, caves, villages, ...)

You use this library by defining procedural functions. A procedural function
may *take* any number of parameters, and can *provide* any number of values.
Additionally, it may *generate* other procedural functions that depend on it,
as well as its values.

Each instance of a procedural function (which you get by calling the function)
has a unique hash which is used when calling any of the built-in pseudo-random
number generators. This means you will always get the same sequence of random
numbers for the same set of parameters, which is the most important aspect of
procedurally generated content.

Here's how you define a procedural function that takes a single parameter:

```javascript
var procedural = require('procedural');
var world = procedural('world').takes('name');
```

You may want a world to define if it's habitable:

```javascript
world.provides('habitable', function (world) {
  // For now, all worlds will be habitable.
  return true;
});
```

You can now create your world instance like this:

```javascript
var earth = world('Earth');
console.log('Does', earth.name, 'support life?');
console.log(earth.habitable ? 'Yes' : 'No');
```

Now it makes sense for a region in a world to be accessible...

```javascript
var region = world.generates('region')
  .takes('x', 'y')
  .provides('temperature', function (region) {
    // Get a random number generator for this region.
    var rnd = region.getRandGen();

    // Make temperature depend on what kind of world we're on.
    if (region.world.habitable) {
      return rnd.nextInt(10, 35);
    } else {
      return rnd.nextInt(1000, 3500);
    }
  });
```

Let's find out what temperature we've got at (0, 0).

```javascript
console.log('Temperature is:', earth.region(0, 0).temperature);
```

Note that every instance automatically gets its own set of random values:

```javascript
var kryptonTemp = world('Krypton').region(0, 0).temperature;
console.log('But on Krypton it is:', kryptonTemp);
```

But wait, Krypton isn't habitable! Let's fix that by revisiting the habitable
value of worlds.

```javascript
world.provides('habitable', function (world) {
  // Only Earth is known to be habitable (for now...).
  return world.name == 'Earth';
});
```

If you rerun all the code together now, you'll see that Krypton will be a bit
hotter than before, while Earth is still comfortable.

I hope this example shows how useful it is to have a set of procedurally
generated values that depend on each other when you want to create random
content that still follows a set of rules.

For another example, see the bottom of this README, or go check out one of
these demos:

* TODO: The space demo.


API
---

TODO: Define the API here.


Full example
------------

How to define a procedurally generated avatar.

```javascript
var avatar = procedural('avatar')
  .takes('username')
  // Size, in blocks.
  .takes('size', function validate(avatar, blocks) {
    // Ensure that size is a positive integer divisible by 2.
    return typeof blocks == 'number' && blocks > 0 && !(blocks % 2);
  })
  // The pixel size of a single (square) block.
  .takes('blockSize', function validate(avatar, px) {
    return typeof px == 'number' && px > 0;
  })
  // Calculate the colors that make up the avatar.
  .provides('hueAngle', function (avatar) {
    // Use a named number generator to get an independent sequence.
    return avatar.getRandGen('color').nextInt(360);
  })
  .provides('background', function (avatar) {
    return 'hsl(' + avatar.hueAngle + ', 100%, 50%)';
  })
  .provides('foreground', function (avatar) {
    var hueAngle = (avatar.hueAngle + 180) % 360;
    return 'hsl(' + hueAngle + ', 100%, 50%)';
  })
  // 75% of avatars have a mirrored effect, others don't.
  .provides('isMirrored', function (avatar) {
    return avatar.getRandGen('mirror').nextFloat() > .25;
  })
  // A particular avatar has a unique set of blocks.
  .generates('block')
    // The validator will run independently for both parameters.
    .takes('x', 'y', function validate(block, xy) {
      // We can refer to the parent instance (the avatar).
      return typeof xy == 'number' && xy >= 0 && xy < block.avatar.size;
    })
    // The color of this block.
    .provides('color', function (block) {
      // You don't have to use named random generators.
      if (block.getRandGen().nextFloat() > .5) {
        return block.avatar.foreground;
      } else {
        return block.avatar.background;
      }
    })
    // Go back to defining the parent (avatar).
    .done()
  // Renders to a canvas and returns a URL for <img>.
  .provides('url', function (avatar) {
    var canvas = document.createElement('canvas'),
        context = canvas.getContext('2d');

    canvas.width = avatar.size * avatar.blockSize;
    canvas.height = avatar.size * avatar.blockSize;

    context.fillStyle = avatar.background;
    context.fillRect(0, 0, avatar.size, avatar.size);

    var finalX = avatar.isMirrored ? avatar.size / 2 : avatar.size,
        blockSize = avatar.blockSize;

    for (var y = 0; y < avatar.size; y++) {
      for (var x = 0; x < finalX; x++) {
        var realX = x * blockSize, realY = y * blockSize;

        var block = avatar.block(x, y);
        context.fillStyle = block.color;
        context.fillRect(realX, realY, blockSize, blockSize);

        if (avatar.isMirrored) {
          var mirroredX = avatar.size * blockSize - realX - blockSize;
          context.fillRect(mirroredX, realY, blockSize, blockSize);
        }
      }
    }

    return canvas.toDataURL();
  });

var img = document.createElement('img');
img.src = avatar('bob', 16, 4).url;
document.body.appendChild(img);
```
