// The entire universe.
var universe = procedural('universe')
  // A random seed to allow for wildly different universes.
  .takes('seed');

// A sector in space which may contain many galaxies.
var sector = universe.generates('sector')
  // The coordinates of the sector.
  .takes('x', 'y')
  .provides('density', function (sector) {
    // TODO: Perlin noise.
    var value = sector.getRandGen().nextFloat();
    return value * value * value;
  });

// A galaxy in space which may contain many stars.
var galaxy = sector.generates('galaxy')
  .takes('number');

// A cluster of stars in a galaxy.
var cluster = galaxy.generates('cluster')
  .takes('x', 'y')
  .provides('numStars', function (cluster) {
    // TODO: Something that generates a random spiral.
    return Math.floor(cluster.galaxy.sector.density * cluster.getRandGen().nextFloat(100));
  });

// A star, which may have smaller bodies circling it.
var star = cluster.generates('star')
  .takes('number', function (star, number) {
    return number > 0 && number <= star.cluster.numStars;
  })
  .provides('numPlanets', function (star) {
    return star.getRandGen('planets').nextInt(0, 10);
  });

// A planet orbiting a star.
var planet = star.generates('planet')
  .takes('number', function (planet, number) {
    return number > 0 && number <= planet.star.numPlanets;
  })
  .provides('distance', function (planet) {
  })
  .provides('mass', function (planet) {
  })
  .provides('volume', function (planet) {
  });

// A satellite orbiting a planet.
var satellite = planet.generates('satellite')
  .takes('number');

var names = ['Alpha', 'Beta', 'Centauri', 'Delta', 'Epsilon', 'Gamma', 'Iota',
             'Kappa', 'Lambda', 'Omega', 'Sigma', 'Tau', 'Zeta', 'Keiper', 'Kepler',
             'Borealis', 'Taurus', 'Milky', 'Orion', 'Virgo', 'Leo', 'Hydra', 'Norma',
             'Sagittarius', 'Perseus', 'Cygnus', 'Cephei', 'Andromeda', 'Sirius',
             'Doge', 'Nyan', 'Haz', 'Chuck', 'Norris', 'Troll', 'Gusta', 'Picard',
             'Fry', 'Greg', 'Grumpy', 'Cat'];

var pieces = [names[~~(Math.random() * names.length)],
              names[~~(Math.random() * names.length)],
              names[~~(Math.random() * names.length)],
              (~~(100 + Math.random() * 900)) + '-' + (~~(10 + Math.random() * 90))];

var name = pieces.join(' ');

var u = universe(name);

var width = 960, height = 540, centerX = width / 2, centerY = height / 2;

// Set up the canvas element.
var canvas = document.querySelector('canvas');
var context = canvas.getContext('2d');
canvas.width = width * window.devicePixelRatio;
canvas.height = height * window.devicePixelRatio;
context.scale(window.devicePixelRatio, window.devicePixelRatio);

context.fillStyle = '#000';
context.fillRect(0, 0, canvas.width, canvas.height);

for (var y = 0; y < height; y += 10) {
  for (var x = 0; x < width; x += 10) {
    var sector = u.sector(x / 10, y / 10);

    var gradient = context.createRadialGradient(x + 5, y + 5, 0, x + 5, y + 5, 5);
    gradient.addColorStop(0, 'rgba(255, 255, 255, ' + sector.density.toFixed(2) + ')');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    //context.fillStyle = 'rgba(255, 255, 255, ' + sector.density + ')';
    context.fillStyle = gradient;
    context.fillRect(x, y, 10, 10);
  }
}

context.font = '32px "Courier New"';
context.fillStyle = '#fff';
context.textAlign = 'center';

context.textBaseline = 'middle';

context.fillText('Welcome to your personal universe', centerX, centerY);
//context.fillText('(' + name + ')', centerX, centerY);
