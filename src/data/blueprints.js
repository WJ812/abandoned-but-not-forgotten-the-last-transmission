/**
 * blueprints.js -- the two core Blueprint cards (contract section 5, BlueprintCard).
 *
 * Sources: NASA NSSDCA "Apollo Lunar Roving Vehicle" fact sheet; Apollo 17
 * Mission Report (MSC-07904); Apollo Lunar Surface Journal (ALSJ); NASA/JPL
 * Mars Pathfinder rover fact sheets and press kit (1997).
 */
import { Blueprint } from '../contract.js';
import { deepFreeze } from './util.js';

export const BLUEPRINTS = deepFreeze({
  [Blueprint.LRV]: {
    id: Blueprint.LRV,
    name: 'Lunar Roving Vehicle (LRV)',
    subsystem: 'Mobility & Battery System',
    dates: 'Apollo 17 - December 1972',
    schematic: 'schematic_lrv',
    explorerPages: [
      'Aim: carry two astronauts much farther than they could walk. On Apollo 15, 16, and 17 the rover turned short walks into long drives to mountains and craters kilometers from the lander.',
      'Discovery: on Apollo 17 it drove about 35.7 km and reached 7.6 km from the lander. It helped the crew gather about 110 kg of samples for the mission, including orange volcanic glass from Shorty crater.',
    ],
    archivistPages: [
      'Power: two 36 V silver-zinc primary batteries, 121 Ah each (about 8.7 kWh in all), never recharged. Each wheel had its own 0.25 hp DC motor, so the rover could keep driving if one motor failed.',
      'Speed: designed for about 13 km/h on level ground; Gene Cernan recorded a top speed of 18 km/h on Apollo 17. The 210 kg rover weighed on the Moon what 35 kg weighs on Earth (g = 1.62 m/s2).',
      'Built by Boeing, with wheels and motors by GM Delco. It folded into a bay on the side of the Lunar Module descent stage and unfolded on the surface, with wheels of woven steel wire instead of rubber tires.',
    ],
    telemetry: [
      { label: 'Mass (Earth)', value: '210 kg' },
      { label: 'Payload capacity', value: '490 kg' },
      { label: 'Batteries', value: '2 x 36 V silver-zinc, 121 Ah' },
      { label: 'Rechargeable', value: 'No (primary cells)' },
      { label: 'Wheel motors', value: '4 x 0.25 hp DC' },
      { label: 'Design speed', value: 'about 13 km/h' },
      { label: 'Recorded top speed', value: '18 km/h (Apollo 17)' },
      { label: 'Apollo 17 distance', value: 'about 35.7 km' },
      { label: 'Farthest from LM', value: '7.6 km' },
      { label: 'Flown on', value: 'Apollo 15, 16, 17 (1971-72)' },
    ],
    trueScale: [
      { label: 'Length', value: '3.1 m' },
      { label: 'Wheelbase', value: '2.3 m' },
      { label: 'Height', value: '1.14 m' },
      { label: 'Wheel diameter', value: '81.8 cm' },
    ],
  },

  [Blueprint.SOJOURNER]: {
    id: Blueprint.SOJOURNER,
    name: 'Sojourner Rover',
    subsystem: '6-Wheel Rocker-Bogie Mobility System',
    dates: 'Mars Pathfinder - July 1997',
    schematic: 'schematic_sojourner',
    explorerPages: [
      'Aim: prove that a small robot could drive itself on Mars. Sojourner rolled down the ramp of the Pathfinder lander on July 5, 1997, and became the first wheeled rover on Mars.',
      'Discovery: over 83 sols it studied rocks like Barnacle Bill and Yogi with its X-ray spectrometer. It showed that Mars rocks are varied, and that a rover can steer around hazards on its own.',
    ],
    archivistPages: [
      'Rocker-bogie: six wheels on linked rocker arms with no springs, so every wheel stays on the ground over rocks. All six wheels are driven and the four corner wheels steer. Top speed: 1 cm/s.',
      'Power: a 16 W gallium arsenide solar panel plus non-rechargeable lithium thionyl chloride (LiSOCl2) batteries. Brain: an Intel 80C85 CPU. All commands were relayed through the lander. g = 3.72 m/s2.',
    ],
    telemetry: [
      { label: 'Mass', value: 'about 10.5 kg (23 lb)' },
      { label: 'Solar panel', value: '16 W GaAs, about 0.22 m2' },
      { label: 'Backup battery', value: 'LiSOCl2, not rechargeable' },
      { label: 'Top speed', value: '1 cm/s' },
      { label: 'Mission length', value: '83 sols (planned 7)' },
      { label: 'Total distance', value: 'about 100 m' },
      { label: 'Farthest from lander', value: 'about 12 m' },
      { label: 'Science instrument', value: 'APXS spectrometer' },
      { label: 'Landed', value: 'July 4, 1997' },
    ],
    trueScale: [
      { label: 'Length', value: '65 cm' },
      { label: 'Width', value: '48 cm' },
      { label: 'Height', value: '30 cm' },
      { label: 'Wheel diameter', value: '13 cm' },
    ],
  },
});
