import type { ReactNode } from 'react'
import { navigate } from '../lib/router'
import { ArrowLeftIcon, Button } from './ui'
import { useT } from '../lib/i18n'

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
  const m = useT()
  return (
    <header className="TopBar">
      <div className="TopBar-inner">
        {back !== undefined && (
          <Button size="icon" variant="ghost" aria-label={m.common.back} onClick={() => navigate(back)}>
            <ArrowLeftIcon />
          </Button>
        )}
        <div className="TopBar-titles">
          <h1>{title}</h1>
          {subtitle && <p className="TopBar-subtitle">{subtitle}</p>}
        </div>
        {actions && <nav className="TopBar-actions">{actions}</nav>}
      </div>
    </header>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="Page">{children}</main>
}

export function Section({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="Section">
      {(title || actions) && (
        <div className="Section-header">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
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
    <section className="EmptyState">
      <h2>{title}</h2>
      <p>{description}</p>
      {children && <div className="Row">{children}</div>}
    </section>
  )
}

export function Spinner() {
  const m = useT()
  return (
    <p className="Spinner" role="status">
      {m.common.loading}
    </p>
  )
}
