/** The 8 faces she can pull (these are the drawings in the art brief). */
export type MascotExpression = 'neutral' | 'happy' | 'judging' | 'shocked' | 'suspicious' | 'proud' | 'sleepy' | 'love'
export type MascotPose = 'stand' | 'sit' | 'peek' | 'wave' | 'cheer'
export type MascotAnimation = 'none' | 'hop' | 'shake' | 'faint' | 'spin' | 'nod' | 'wiggle'

/** How she feels about it. Each mood maps to a face + a move (see moods.ts). */
export type Mood = 'chill' | 'suspicious' | 'judging' | 'concerned' | 'proud' | 'impressed' | 'devastated' | 'evil'
