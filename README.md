procedural
==========

Library for defining procedural functions.


Example
-------

```javascript
var universe = procedural('universe');

universe
  .withInput('seed')
  // Create a "hash" value with the seed hashed in.
  .withHashFrom('global.baseHash', 'seed')
  // Systems can be found on a 2D plane (a space map!).
  .generates('system')
    .withInputs('x', 'y')
    .withHashFrom('universe.hash', 'x', 'y')
    // Calculate an arbitrary (but deterministic) number of planets.
    .withValue('numPlanets', system => Math.max(Math.round(Math.sin(system.hash / Math.PI) * 10), 0))
    .generates('planet')
      .withInput('number', (planet, number) => number > 0 && number <= planet.system.numPlanets)
      .withHashFrom('system.hash', 'number')
      .withValue('temperature', planet => Math.round(Math.cos(planet.hash / Math.PI) * 1000));

var system = universe('a random seed').system(123, 456);
if (system.numPlanets > 0) {
  console.log('LAND AHOY!');
  if (system.planet(1).temperature < 10) {
    console.log('It looks a bit nippy...');
  }
}
```
