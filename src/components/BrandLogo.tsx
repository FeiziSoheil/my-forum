import Link from 'next/link'
import { cn } from '@/lib/utils'

type BrandLogoProps = {
  href?: string | null
  showWordmark?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { mark: 'size-8', word: 'text-base' },
  md: { mark: 'size-10', word: 'text-lg' },
  lg: { mark: 'size-12', word: 'text-2xl' },
} as const

function LogoMark({ size }: { size: keyof typeof sizes }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt=""
      className={cn('shrink-0 rounded-[22%]', sizes[size].mark)}
    />
  )
}

export default function BrandLogo({
  href = '/',
  showWordmark = true,
  size = 'sm',
  className,
}: BrandLogoProps) {
  const content = (
    <>
      <LogoMark size={size} />
      {showWordmark && (
        <span className={cn('font-bold tracking-tight', sizes[size].word)}>
          Parakgram
        </span>
      )}
    </>
  )

  if (href === null) {
    return <div className={cn('inline-flex items-center gap-2', className)}>{content}</div>
  }

  return (
    <Link href={href} className={cn('inline-flex items-center gap-2', className)}>
      {content}
    </Link>
  )
}
