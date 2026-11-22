/* eslint-disable react/only-export-components */
// Thin wrappers around Base UI components, styled in src/styles.css.
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button as BaseButton } from '@base-ui/react/button'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Dialog } from '@base-ui/react/dialog'
import { Field as BaseField } from '@base-ui/react/field'
import { Fieldset as BaseFieldset } from '@base-ui/react/fieldset'
import { Input } from '@base-ui/react/input'
import { Menu } from '@base-ui/react/menu'
import { Progress } from '@base-ui/react/progress'
import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { Toast } from '@base-ui/react/toast'
import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Fragment, useId, type ComponentProps, type ReactNode } from 'react'
import { cx } from '../lib/utils'

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger'
type ButtonSize = 'md' | 'lg' | 'icon'

export function Button({
  variant = 'default',
  size = 'md',
  className,
  ...props
}: Omit<ComponentProps<typeof BaseButton>, 'className'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}) {
  return (
    <BaseButton
      className={cx('Button', className)}
      data-variant={variant === 'default' ? undefined : variant}
      data-size={size === 'md' ? undefined : size}
      {...props}
    />
  )
}

export function TextInput({ className, ...props }: Omit<ComponentProps<typeof Input>, 'className'> & { className?: string }) {
  return <Input className={cx('Input', className)} {...props} />
}

export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cx('TextArea', className)} {...props} />
}

/** Base UI Field: label, control and description wired together for accessibility. */
export function Field({
  label,
  description,
  aside,
  children,
}: {
  label: ReactNode
  description?: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <BaseField.Root className="Field">
      <div className="Field-label">
        <BaseField.Label>{label}</BaseField.Label>
        {aside}
      </div>
      {children}
      {description && <BaseField.Description className="Field-description">{description}</BaseField.Description>}
    </BaseField.Root>
  )
}

export const FieldControl = BaseField.Control

export function Fieldset({ legend, children }: { legend: ReactNode; children: ReactNode }) {
  return (
    <BaseFieldset.Root className="Fieldset">
      <BaseFieldset.Legend className="Fieldset-legend">{legend}</BaseFieldset.Legend>
      {children}
    </BaseFieldset.Root>
  )
}

export function Switch({
  label,
  description,
  ...props
}: ComponentProps<typeof BaseSwitch.Root> & { label: ReactNode; description?: ReactNode }) {
  const id = useId()
  return (
    <div className="SwitchField">
      <div className="SwitchField-text">
        <label htmlFor={id}>{label}</label>
        {description && <span className="Muted">{description}</span>}
      </div>
      <BaseSwitch.Root id={id} className="Switch" {...props}>
        <BaseSwitch.Thumb className="Switch-thumb" />
      </BaseSwitch.Root>
    </div>
  )
}

export function Checkbox(props: ComponentProps<typeof BaseCheckbox.Root>) {
  return (
    <BaseCheckbox.Root className="Checkbox" {...props}>
      <BaseCheckbox.Indicator className="Checkbox-indicator">
        <CheckIcon />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  multiple = false,
  label,
}: {
  value: T[]
  onChange: (value: T[]) => void
  options: Array<{ value: T; label: ReactNode }>
  multiple?: boolean
  label: string
}) {
  return (
    <ToggleGroup
      className="ToggleGroup"
      aria-label={label}
      multiple={multiple}
      value={value}
      onValueChange={(v) => {
        if (v.length > 0) onChange(v as T[])
      }}
    >
      {options.map((o) => (
        <Toggle key={o.value} value={o.value} className="Toggle">
          {multiple && value.includes(o.value) && <CheckIcon />}
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'lg'
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="Backdrop" />
        <Dialog.Popup className="Popup" data-size={size}>
          <div className="Popup-intro">
            <Dialog.Title className="Popup-title">{title}</Dialog.Title>
            {description && <Dialog.Description className="Popup-description">{description}</Dialog.Description>}
          </div>
          {children}
          <div className="Popup-actions">
            <Dialog.Close render={<Button />}>Close</Dialog.Close>
            {footer}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="Backdrop" />
        <AlertDialog.Popup className="Popup">
          <div className="Popup-intro">
            <AlertDialog.Title className="Popup-title">{title}</AlertDialog.Title>
            <AlertDialog.Description className="Popup-description">{description}</AlertDialog.Description>
          </div>
          <div className="Popup-actions">
            <AlertDialog.Close render={<Button />}>Cancel</AlertDialog.Close>
            <Button
              variant="danger"
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export function DropdownMenu({
  label,
  items,
}: {
  label: string
  items: Array<{ label: string; onClick: () => void; danger?: boolean; separatorBefore?: boolean }>
}) {
  return (
    <Menu.Root>
      <Menu.Trigger render={<Button />}>
        {label} <ChevronDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" style={{ zIndex: 50 }}>
          <Menu.Popup className="Menu-popup">
            {items.map((item) => (
              <Fragment key={item.label}>
                {item.separatorBefore && <Menu.Separator className="Menu-separator" />}
                <Menu.Item className="Menu-item" data-danger={item.danger || undefined} onClick={item.onClick}>
                  {item.label}
                </Menu.Item>
              </Fragment>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function ProgressBar({ value, label }: { value: number; label: ReactNode }) {
  return (
    <Progress.Root className="Progress" value={Math.round(value)}>
      <Progress.Label className="Progress-label">{label}</Progress.Label>
      <Progress.Value className="Progress-value" />
      <Progress.Track className="Progress-track">
        <Progress.Indicator className="Progress-indicator" />
      </Progress.Track>
    </Progress.Root>
  )
}

export const toastManager = Toast.createToastManager()

export function notify(title: string, description?: string, type: 'success' | 'error' = 'success') {
  toastManager.add({ title, description, type })
}

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className="Toast" data-type={toast.type}>
      <Toast.Content className="Toast-content">
        <div className="Toast-text">
          <Toast.Title className="Toast-title" />
          <Toast.Description className="Toast-description" />
        </div>
        <Toast.Close render={<Button size="icon" variant="ghost" />} aria-label="Close">
          <CloseIcon />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ))
}

export function Toaster({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager} timeout={3500} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="Toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

export function StarToggle({
  starred,
  onToggle,
  label = 'Star this card',
}: {
  starred: boolean
  onToggle: () => void
  label?: string
}) {
  return (
    <Toggle
      className="Star"
      pressed={starred}
      onPressedChange={onToggle}
      aria-label={label}
      title={starred ? 'Starred – click to remove' : 'Star to focus on this card'}
      onClick={(e) => e.stopPropagation()}
    >
      <StarIcon />
    </Toggle>
  )
}

const iconProps = {
  width: 12,
  height: 12,
  viewBox: '0 0 12 12',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true,
} as const

export function CheckIcon() {
  return (
    <svg {...iconProps} width={10} height={10} viewBox="0 0 10 10">
      <path d="M1.5 5.5 4 8l4.5-6" strokeLinecap="square" />
    </svg>
  )
}

export function ChevronDownIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  )
}

export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M4.5 2.5 8 6 4.5 9.5" />
    </svg>
  )
}

export function ArrowLeftIcon() {
  return (
    <svg {...iconProps} width={14} height={14} viewBox="0 0 14 14">
      <path d="M12 7H2.5M6.5 3 2.5 7l4 4" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg {...iconProps}>
      <path d="m2.5 2.5 7 7m0-7-7 7" />
    </svg>
  )
}

export function StarIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round">
      <path d="M8 1.75l1.9 3.95 4.35.6-3.17 3.03.78 4.32L8 11.58l-3.86 2.07.78-4.32L1.75 6.3l4.35-.6z" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 1.5v9M1.5 6h9" />
    </svg>
  )
}
