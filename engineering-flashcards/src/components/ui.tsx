/* eslint-disable react/only-export-components */
// Thin wrappers around unstyled Base UI components. No styling on purpose.
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button as BaseButton } from '@base-ui/react/button'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Dialog } from '@base-ui/react/dialog'
import { Input } from '@base-ui/react/input'
import { Menu } from '@base-ui/react/menu'
import { Progress } from '@base-ui/react/progress'
import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { Toast } from '@base-ui/react/toast'
import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import type { ComponentProps, ReactNode } from 'react'

export const Button = BaseButton
export const TextInput = Input

export function TextArea(props: ComponentProps<'textarea'>) {
  return <textarea {...props} />
}

export function Switch({
  label,
  description,
  checked,
  ...props
}: ComponentProps<typeof BaseSwitch.Root> & { label: ReactNode; description?: ReactNode }) {
  return (
    <div>
      <label>
        <BaseSwitch.Root checked={checked} {...props}>
          <BaseSwitch.Thumb />
          {checked ? 'Wł.' : 'Wył.'}
        </BaseSwitch.Root>{' '}
        {label}
      </label>
      {description && <p>{description}</p>}
    </div>
  )
}

export function Checkbox({ checked, ...props }: ComponentProps<typeof BaseCheckbox.Root>) {
  return (
    <BaseCheckbox.Root checked={checked} {...props}>
      {checked ? '☑' : '☐'}
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
      aria-label={label}
      multiple={multiple}
      value={value}
      onValueChange={(v) => {
        if (v.length > 0) onChange(v as T[])
      }}
    >
      {options.map((o) => (
        <Toggle key={o.value} value={o.value}>
          {value.includes(o.value) ? '● ' : '○ '}
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>{title}</Dialog.Title>
          {description && <Dialog.Description>{description}</Dialog.Description>}
          {children}
          <div>
            {footer}
            <Dialog.Close>Zamknij</Dialog.Close>
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
        <AlertDialog.Backdrop />
        <AlertDialog.Popup>
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div>
            <AlertDialog.Close>Anuluj</AlertDialog.Close>
            <Button
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
  items: Array<{ label: string; onClick: () => void }>
}) {
  return (
    <Menu.Root>
      <Menu.Trigger>{label}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="end">
          <Menu.Popup>
            {items.map((item) => (
              <Menu.Item key={item.label} onClick={item.onClick}>
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <Progress.Root value={Math.round(value)}>
      <Progress.Label>{label}</Progress.Label> <Progress.Value />
      <Progress.Track>
        <Progress.Indicator />
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
    <Toast.Root key={toast.id} toast={toast}>
      <Toast.Content>
        <Toast.Title />
        <Toast.Description />
        <Toast.Close>Zamknij</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ))
}

export function Toaster({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager} timeout={3500} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
