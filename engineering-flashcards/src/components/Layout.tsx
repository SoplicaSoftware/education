import type { ReactNode } from 'react'
import { navigate } from '../lib/router'
import { Button } from './ui'

export function TopBar({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: string
  actions?: ReactNode
}) {
  return (
    <header>
      {back !== undefined && <Button onClick={() => navigate(back)}>← Wstecz</Button>}
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {actions && <nav>{actions}</nav>}
      <hr />
    </header>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <main>{children}</main>
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string
  description: ReactNode
  children?: ReactNode
}) {
  return (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {children && <div>{children}</div>}
    </section>
  )
}

export function Spinner() {
  return <p role="status">Wczytywanie…</p>
}
