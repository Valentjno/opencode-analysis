import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeChoice } from '../lib/theme'

interface Props {
  choice: ThemeChoice
  onChoose: (choice: ThemeChoice) => void
}

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'Follow system theme', Icon: Monitor },
  { value: 'light', label: 'Use light theme', Icon: Sun },
  { value: 'dark', label: 'Use dark theme', Icon: Moon },
]

export function ThemeToggle({ choice, onChoose }: Props) {
  return (
    <div className="segmented" role="group" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={choice === value}
          onClick={() => onChoose(value)}
        >
          <Icon size={13} strokeWidth={1.7} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
