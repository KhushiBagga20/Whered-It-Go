import type { MascotExpression, MascotPose } from './types'

/**
 * Every pose and face the app can ask for — the art checklist.
 * The gallery page (/mascot) and docs/tiny-khushi-art-brief.md follow this.
 */

export interface PoseInfo {
  id: MascotPose
  label: string
  where: string
  /** Export size in px (width × height). */
  canvas: [number, number]
}

export interface ExpressionInfo {
  id: MascotExpression
  label: string
  face: string
  when: string
}

export const POSES: PoseInfo[] = [
  {
    id: 'sit',
    label: 'Sitting',
    where: 'On the hill above the nav, on the donut chart, next to the Money total, the loading screen.',
    canvas: [480, 720],
  },
  {
    id: 'peek',
    label: 'Peeking',
    where: 'Over the top of the Calendar and over the edge of the add-transaction sheet.',
    canvas: [720, 600],
  },
  {
    id: 'stand',
    label: 'Standing',
    where: 'Empty states (“Look at you. Responsible.”), the error screen, the desktop side panel.',
    canvas: [480, 720],
  },
  {
    id: 'wave',
    label: 'Waving',
    where: 'Sign-in and first-run onboarding (“hi. i’m tiny khushi.”). Happy face only.',
    canvas: [540, 720],
  },
]

export const EXPRESSIONS: ExpressionInfo[] = [
  {
    id: 'neutral',
    label: 'Neutral',
    face: 'Resting face, open eyes, small closed smile.',
    when: 'Default. Small spends: “acceptable.” Poking her.',
  },
  {
    id: 'judging',
    label: 'Judging',
    face: 'Half-lidded eyes, one eyebrow up, flat mouth.',
    when: '₹150–₹1,500 spends: “hmm.” / “bro.” Subscriptions. Resting face on the chart.',
  },
  {
    id: 'suspicious',
    label: 'Suspicious',
    face: 'Side-eye, eyebrows angled in, wobbly mouth.',
    when: 'Shopping: “interesting.” Food again: “you again?” Deleting/editing. Empty states.',
  },
  {
    id: 'shocked',
    label: 'Shocked',
    face: 'Huge round eyes, raised brows, little “o” mouth.',
    when: '₹1,500+: “WHERE’D IT GO?” The error screen. Typing a big amount.',
  },
  {
    id: 'happy',
    label: 'Happy',
    face: '^ ^ eyes, open smile.',
    when: 'Money coming in: “oh look who’s rich now.” Greetings. Onboarding.',
  },
  {
    id: 'proud',
    label: 'Proud',
    face: 'Closed happy eyes, smug one-sided smile.',
    when: 'No-spend streaks: “character development?” College spends. Calm days.',
  },
  {
    id: 'love',
    label: 'Love',
    face: 'Heart eyes, open smile.',
    when: 'Gifts: “is this for me?” Big income. Health spends: “take care of yourself.”',
  },
  {
    id: 'sleepy',
    label: 'Sleepy',
    face: 'Closed droopy eyes, tiny “o” mouth, no brows.',
    when: 'Loading screen, late-night check-ins, “Nobody paid you. Tragic.”, future days.',
  },
]

/** The combinations the app actually renders (25). */
export const REQUIRED_SPRITES: string[] = [
  ...(['sit', 'peek', 'stand'] as const).flatMap((p) => EXPRESSIONS.map((e) => `${p}-${e.id}`)),
  'wave-happy',
]
