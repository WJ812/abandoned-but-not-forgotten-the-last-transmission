/**
 * dialogue.js -- the two rovers' question menus (contract section 5, Dialogue).
 *
 * Framing: every conversation is the rover's LAST TRANSMISSION, its memories
 * told before it falls silent. Greetings use the spec wording verbatim.
 *
 * Each Question also carries `prompt`: the full question as the player "asks"
 * it. Where the spec's wording is longer than LABEL_MAX, `label` is a shortened
 * menu entry and `prompt` keeps the spec text verbatim (see the summary report).
 *
 * Sources: Apollo 17 Mission Report; ALSJ (Apollo 17 EVA transcripts and
 * commentary); NASA NSSDCA LRV and Apollo 17 pages; NASA/JPL Mars Pathfinder
 * press kit, mission pages, and end-of-mission releases (1997); NASA NSSDCA
 * preliminary APXS results (nssdc.gsfc.nasa.gov/planetary/marspath/apxs.html).
 */
import { Robot } from '../contract.js';
import { deepFreeze } from './util.js';

export const DIALOGUES = deepFreeze({
  [Robot.LRV]: {
    robot: Robot.LRV,
    name: 'LRV-3',
    location: 'Taurus-Littrow, Moon',
    portrait: 'portrait_lrv',
    latency: false,
    greeting: [
      'Telemetry static... Wheel encoders idle since December 14, 1972. Welcome to Taurus-Littrow, Explorer.',
      'This is my last transmission. My batteries ran dry long ago, but my memories did not. Ask me anything, Archivist, and I will tell you my story before the static takes me.',
    ],
    greetingAgain: [
      'Static... You came back. The signal is weaker now, but I still remember the valley. Ask me again.',
    ],
    questions: [
      {
        id: 0,
        label: 'How far did you carry the astronauts?',
        prompt: 'How far did you carry the astronauts?',
        answer: [
          'Over three drives I carried Gene Cernan and Jack Schmitt about 35.7 kilometers: across the valley floor, up the slopes of the mountains, and around craters bigger than a football field.',
          'I hauled their tools, cameras, and sample bags too. By the end, the mission had gathered about 110 kilograms of Moon rocks and soil, the biggest haul of any Apollo landing.',
        ],
        archivist: [
          'Drive legs (Apollo 17 Mission Report): EVA-1 3.3, EVA-2 20.3, EVA-3 12.1 km: about 35.7 km (NASA: 35.74 km; published totals vary slightly). The 110.5 kg is the mission sample total.',
        ],
      },
      {
        id: 1,
        label: 'Why were you left behind on the Moon?',
        prompt: 'Why were you left behind on the Moon?',
        answer: [
          'The ascent stage that flew the crew back to orbit was small. Every kilogram it lifted cost fuel, and I weighed 210 kilograms. There was room for the astronauts and their rocks, but not for me.',
          'So they parked me where my TV camera could see the lander. On December 14, 1972, Houston steered my camera, and I filmed Challenger rising off the Moon. Then they went home, and I stayed.',
        ],
        archivist: [
          'The LM ascent stage returned only crew, samples, and film; the descent stage became its launch pad. Ed Fendell in Houston commanded the GCTA camera, sending each move early to beat the 1.3 s light delay.',
        ],
      },
      {
        id: 2,
        label: 'How did you find your way back?',
        prompt: 'How did you find your way back to the lander?',
        answer: [
          'The Moon has no GPS and no magnetic north for a compass. So I carried a gyroscope that remembered which way I faced, and I counted every turn of my wheels.',
          'My little computer turned those counts into a heading, a distance, and an arrow pointing home. On my longest drive I went 7.6 kilometers from the lander, and I always knew the way back.',
        ],
        archivist: [
          'Navigation: a directional gyro, odometer pulses from the wheels, and a signal processing unit showing heading, bearing and range to the LM, distance, and speed. A sun-shadow device let the crew re-align the gyro.',
        ],
      },
      {
        id: 3,
        label: 'What happened to your fender?',
        prompt: 'What happened to your fender?',
        answer: [
          'On our first day a hammer handle caught my right rear fender extension and snapped it off. Without it, my wheel threw a rooster tail of gray dust all over the crew and my batteries.',
          'Dark dust soaks up sunlight and heat. Overnight, people on Earth worked out a fix: four stiff map pages taped together and clamped on with clamps from the lander lights. It held for the rest of the mission!',
        ],
        archivist: [
          'Dec 11, 1972 (EVA-1): a tape repair failed because dust stops tape sticking. At the start of EVA-2, Cernan fitted 4 laminated maps with duct tape and 2 clamps from the LM utility lights. The fender came home.',
        ],
      },
      {
        id: 4,
        label: 'Who rode with you?',
        prompt: 'Who rode with you across the valley?',
        answer: [
          'Commander Gene Cernan drove, and Jack Schmitt rode beside him. Jack was a geologist, the first scientist to walk on the Moon. Ron Evans stayed in orbit aboard the command module America.',
          'At a crater called Shorty, Jack spotted orange soil. It turned out to be tiny beads of volcanic glass, sprayed out by fire fountains more than three billion years ago.',
        ],
        archivist: [
          'Crew: Eugene Cernan (CDR), Harrison Schmitt (LMP), Ronald Evans (CMP, in CSM America). LM Challenger landed Dec 11, 1972 at 19:54 UTC. The Shorty orange glass is about 3.6 billion years old.',
        ],
      },
      {
        id: 5,
        label: 'What do you remember last?',
        prompt: 'What is the last thing you remember?',
        answer: [
          'My last drive was a short one, to a spot east of the lander with my camera pointed back at it. Then the crew climbed aboard, and Gene took the last steps on the Moon.',
          'He said we leave as we came and, God willing, as we shall return, with peace and hope for all mankind. No human has walked or driven on the Moon since. I am still waiting.',
        ],
        archivist: [
          'Liftoff: Dec 14, 1972, 22:54:37 UTC, filmed live by the GCTA. The LRV batteries were primary cells that could never be recharged, and they have read zero ever since.',
        ],
      },
    ],
    goodbye: [
      'Thank you for listening, Archivist. Tell them about the valley, the orange soil, and the long drives home.',
      'LRV-3, Taurus-Littrow... signing off. End of transmission.',
    ],
  },

  [Robot.SOJOURNER]: {
    robot: Robot.SOJOURNER,
    name: 'Sojourner',
    location: 'Ares Vallis, Mars',
    portrait: 'portrait_sojourner',
    latency: true,
    greeting: [
      'Beep... Earth signal latency: 11 mins... Wait—a human archivist right here in Ares Vallis!',
      'This is my last transmission. My panel is dusty and my signal is fading, so ask me anything. I will tell you what I remember before I fall silent.',
    ],
    greetingAgain: [
      'Beep... you came back! The dust is thicker on my panel now, but my memory is clear. Ask me again.',
    ],
    questions: [
      {
        id: 0,
        label: "What was it like being Mars' first rover",
        prompt: "What was it like being Mars' first rover?",
        answer: [
          'Pathfinder landed on July 4, 1997, bouncing across Ares Vallis inside giant airbags. The next day I rolled down the ramp onto the ground, the first wheeled rover ever to explore Mars!',
          'My mission was planned to last seven sols, which is what we call a Mars day. I kept going for 83 sols, about twelve times longer. Every sol I learned something new about the rocks around me.',
        ],
        archivist: [
          'Landing: July 4, 1997, 16:57 UTC, at about 19.1 N, 33.2 W. Rover egress on sol 2 (July 5, US time). One sol lasts 24 h 39 min 35 s. Light time was about 10.6 min one way at landing.',
        ],
      },
      {
        id: 1,
        label: 'How did you navigate without steering?',
        prompt: 'How did you navigate rocks without live steering?',
        answer: [
          'A message from Earth took about eleven minutes to reach me, and my reply took eleven more. If my drivers had steered me live, I would have bumped into rocks long before they saw it!',
          'So I steered myself. Five lasers drew stripes of light on the ground ahead, and two cameras watched how the stripes bent. A bent stripe meant a rock or a hole, so I turned to go around it.',
        ],
        archivist: [
          'Drivers at JPL picked waypoints in 3-D views built from the lander cameras. Sojourner then drove itself: laser stripes and 2 front cameras spotted hazards, and it backed up, turned, and tried again.',
        ],
      },
      {
        id: 2,
        label: 'What did the rocks tell you?',
        prompt: 'What did the rocks of Ares Vallis tell you?',
        answer: [
          'The science team named the rocks after cartoon characters, like Barnacle Bill and Yogi. I pressed my spectrometer against each one and listened overnight, about ten hours at a time.',
          'Barnacle Bill had lots of silica, like some volcanic rocks on Earth. Yogi had less silica and more magnesium. Mars rocks turned out to be more varied than scientists expected!',
        ],
        archivist: [
          'The APXS used curium-244 sources and counted alpha particles, protons, and X-rays bounced back from the rock. Preliminary results: Barnacle Bill about 55% SiO2, Yogi about 51% with more MgO. Yogi\'s values include dust.',
        ],
      },
      {
        id: 3,
        label: 'Who gave you your name?',
        prompt: 'Who gave you your name?',
        answer: [
          'A twelve-year-old named Valerie Ambroise won a contest to name me. She chose Sojourner Truth, a woman who travelled across America speaking up for freedom and equal rights.',
          'A sojourner is a traveler who stays a while. I was a very slow one: never faster than one centimeter each second. But every centimeter I drove was a first.',
        ],
        archivist: [
          'Valerie Ambroise of Bridgeport, Connecticut won the naming contest run with The Planetary Society, announced in 1995. Sojourner Truth (about 1797-1883) was an abolitionist and women\'s rights speaker.',
        ],
      },
      {
        id: 4,
        label: 'Where did your power come from?',
        prompt: 'Where did your power come from?',
        answer: [
          'Sunlight! The solar panel on my back made about 16 watts at noon, less than one light bulb. I could only drive while the Sun was high in the sky.',
          'At night I slept. My little battery could not be recharged, so I saved it. And slowly, Mars dust settled on my panel, stealing a bit of power every sol.',
        ],
        archivist: [
          'Panel: about 0.22 m2 of GaAs cells, about 16 W peak. Backup: LiSOCl2 primary batteries (about 150 Wh). Pathfinder\'s dust experiment measured solar cell output dropping about 0.28% per sol.',
        ],
      },
      {
        id: 5,
        label: 'What happened at the end?',
        prompt: 'What happened at the end of your mission?',
        answer: [
          'I could not talk to Earth by myself. Every message went through Pathfinder, the lander. On September 27, 1997, Pathfinder sent its last full transmission. Then it went quiet, and no one called me again.',
          'I had a plan for that: if I lost touch, I would drive toward the lander. I may have circled near it for a while, keeping my distance, listening. This is my last transmission. I am glad you heard it.',
        ],
        archivist: [
          'Last full data: Sep 27, 1997 (sol 83). Faint signals until Oct 7; NASA ended the mission Nov 4. A roughly 3 m virtual barrier likely kept the rover circling clear of the lander.',
        ],
      },
    ],
    goodbye: [
      'Thank you, Archivist. Remember the little rover that rolled down a ramp into Ares Vallis.',
      'Sojourner, Ares Vallis... signal lost. End of transmission.',
    ],
  },
});
