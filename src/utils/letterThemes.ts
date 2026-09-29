export type LetterThemeId = 'romance' | 'birthday' | 'sympathy' | 'family' | 'friendship' | 'other'

// IDs match letters.letter_theme and the storefront theme renderer.
export const LETTER_THEMES: Array<{ id: LetterThemeId | null; name: string; description: string; ink: string; paper: string; headline: string; notes: string }> = [
  { id: 'romance', name: 'Romance', description: 'Blush petals and heartfelt words.', ink: '#913f58', paper: '#fff5f4', headline: 'Some feelings deserve a letter.', notes: 'Love notes' },
  { id: 'birthday', name: 'Birthday', description: 'Lavender, warm yellow, and birthday wishes.', ink: '#65449c', paper: '#fff9e9', headline: 'A wish, wrapped just for you.', notes: 'Birthday wishes' },
  { id: 'sympathy', name: 'Sympathy', description: 'Quiet sage tones for support or remembrance.', ink: '#48685d', paper: '#f6f7f1', headline: 'You don’t have to find the words.', notes: 'Words of comfort' },
  { id: 'family', name: 'Family', description: 'Warm cream, terracotta, and shared memories.', ink: '#955138', paper: '#fff5e9', headline: 'Home is in the people we love.', notes: 'Family notes' },
  { id: 'friendship', name: 'Friendship', description: 'Fresh green tones for a friendship worth celebrating.', ink: '#407d7d', paper: '#fbfffa', headline: 'Life is brighter with you in it.', notes: 'Friendship notes' },
  { id: 'other', name: 'Just Because', description: 'A violet keepsake for every meaningful moment.', ink: '#71658f', paper: '#fefcff', headline: 'Somebody thought of you today.', notes: 'Little notes' },
  { id: null, name: 'Classic (original)', description: 'Keep the original ten-page letter design.', ink: '#8d5265', paper: '#fff4f7', headline: 'Your original letter experience.', notes: 'Petal Messages' },
]

export function normalizeTheme(value: unknown): LetterThemeId | null {
  return LETTER_THEMES.some(theme => theme.id !== null && theme.id === value) ? value as LetterThemeId : null
}

export function getTheme(value: unknown, sympathyMode?: unknown) {
  const theme = LETTER_THEMES.find(theme => theme.id === normalizeTheme(value))!
  return theme.id === 'sympathy' && sympathyMode === 'remembrance'
    ? { ...theme, headline: 'A life held close in memory.', notes: 'Words of remembrance' }
    : theme
}
