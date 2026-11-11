import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Input,
  PasswordInput,
  Textarea,
  Select,
  Checkbox,
  Radio,
  RadioGroup,
  Switch,
  FormField,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  StatusBadge,
  Avatar,
  Tabs,
  Tooltip,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Modal,
  Drawer,
  ConfirmDialog,
  useToast,
  Skeleton,
  Price,
  EmptyState,
  ErrorState,
  Pagination,
  Breadcrumbs,
  Stepper,
  Rating,
  DateTime,
} from '../components/ui';
import {
  Heart,
  Search,
  Bell,
  Trash2,
  ArrowRight,
} from 'lucide-react';

/**
 * Design System Visual Testing Page
 * Showcases all UI components in all variants, states, and sizes.
 */
export function DesignSystemPage() {
  const { addToast } = useToast();

  // State for interactive components
  const [activeTab, setActiveTab] = useState('overview');
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [switchVal, setSwitchVal] = useState(true);
  const [checkboxVal, setCheckboxVal] = useState(true);
  const [radioVal, setRadioVal] = useState('standard');
  const [ratingVal, setRatingVal] = useState(4);
  const [currentPage, setCurrentPage] = useState(2);
  const [stepperStep, setStepperStep] = useState(1);

  const tabs = [
    { id: 'overview', label: 'Color & Typography' },
    { id: 'buttons', label: 'Buttons & Icons' },
    { id: 'forms', label: 'Form Elements' },
    { id: 'feedback', label: 'Feedback & Badges' },
    { id: 'overlays', label: 'Modals & Drawers' },
    { id: 'data', label: 'Data & Navigation' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12 text-ink">
      {/* Header */}
      <div className="border-b border-border pb-8">
        <p className="text-xs uppercase font-semibold tracking-wider text-primary mb-2">
          Nexora Design System &bull; Phase F1
        </p>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-ink mb-3">
          Component Gallery & Visual Verification
        </h1>
        <p className="text-body text-lg max-w-2xl leading-relaxed">
          Comprehensive showcase of all UI tokens, buttons, inputs, dialogs,
          drawers, and accessible widgets in all supported states.
        </p>

        {/* Navigation Tabs */}
        <div className="mt-8">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {/* TAB 1: Color & Typography */}
      {activeTab === 'overview' && (
        <div className="space-y-10">
          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-4">
              Palette Swatches
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              <div className="p-4 rounded-xl bg-cream border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-cream border border-border mb-2" />
                <p className="text-xs font-semibold text-ink">Cream #FFF8F0</p>
                <p className="text-2xs text-body">Page Canvas</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-sand border border-border mb-2" />
                <p className="text-xs font-semibold text-ink">Sand #FBEFE0</p>
                <p className="text-2xs text-body">Sections & Soft Fills</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-card border border-border mb-2" />
                <p className="text-xs font-semibold text-ink">Card #FFFFFF</p>
                <p className="text-2xs text-body">Surfaces & Containers</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-border mb-2" />
                <p className="text-xs font-semibold text-ink">Border #F0DFCB</p>
                <p className="text-2xs text-body">Dividers & Outlines</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-primary mb-2" />
                <p className="text-xs font-semibold text-ink">Primary #C2571A</p>
                <p className="text-2xs text-body">Brand CTAs & Accent</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-primary-hover mb-2" />
                <p className="text-xs font-semibold text-ink">Hover #A94814</p>
                <p className="text-2xs text-body">Interactive Hover</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-amber mb-2" />
                <p className="text-xs font-semibold text-ink">Amber #E9A23B</p>
                <p className="text-2xs text-body">Warm Gold Highlights</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-success mb-2" />
                <p className="text-xs font-semibold text-ink">Success #4C8C5A</p>
                <p className="text-2xs text-body">Verified & Active</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-warning mb-2" />
                <p className="text-xs font-semibold text-ink">Warning #D98E04</p>
                <p className="text-2xs text-body">Due & Alerts</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-danger mb-2" />
                <p className="text-xs font-semibold text-ink">Danger #B3362B</p>
                <p className="text-2xs text-body">Errors & Cancelled</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-ink mb-2" />
                <p className="text-xs font-semibold text-ink">Ink #2B1D14</p>
                <p className="text-2xs text-body">Headings & High Contrast</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border shadow-warm-xs">
                <div className="h-12 w-full rounded bg-body mb-2" />
                <p className="text-xs font-semibold text-ink">Body #6B5646</p>
                <p className="text-2xs text-body">Secondary Copy & Text</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-ink mb-4">
              Typography Hierarchy
            </h2>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <span className="text-xs font-mono text-body">Font-Serif (Fraunces) 4xl</span>
                  <p className="font-serif text-4xl font-bold text-ink">The quiet art of stewardship.</p>
                </div>
                <div>
                  <span className="text-xs font-mono text-body">Font-Serif (Fraunces) 2xl</span>
                  <p className="font-serif text-2xl font-semibold text-ink">Restored stone farmhouse in the hills.</p>
                </div>
                <div>
                  <span className="text-xs font-mono text-body">Font-Sans (Inter) Regular Body</span>
                  <p className="font-sans text-base text-body leading-relaxed max-w-xl">
                    Every space listed on Nexora goes through a rigorous inspection protocol.
                    Our community stewards ensure property preservation without sacrificing modern comfort.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      )}

      {/* TAB 2: Buttons & Icons */}
      {activeTab === 'buttons' && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Button Variants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Medium</Button>
                <Button variant="primary" size="lg">Large (Touch Friendly)</Button>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" leftIcon={<Heart className="w-4 h-4" />}>
                  Left Icon
                </Button>
                <Button variant="secondary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Right Icon
                </Button>
                <Button variant="primary" loading>
                  Loading State
                </Button>
                <Button variant="primary" disabled>
                  Disabled
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accessible Icon Buttons (Min 44px)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <IconButton icon={<Heart className="w-5 h-5 text-primary" />} label="Save to favorites" />
                <IconButton icon={<Bell className="w-5 h-5" />} label="View notifications" variant="secondary" />
                <IconButton icon={<Search className="w-5 h-5" />} label="Search spaces" variant="outline" />
                <IconButton icon={<Trash2 className="w-5 h-5 text-danger" />} label="Delete item" variant="ghost" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: Form Elements */}
      {activeTab === 'forms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Text Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Standard Input" hint="Helper hint text">
                <Input placeholder="Enter your full name" />
              </FormField>

              <FormField label="Input with Icon">
                <Input leftIcon={<Search className="w-4 h-4" />} placeholder="Search by city or landmark" />
              </FormField>

              <FormField label="Password Input with Visibility Toggle" required>
                <PasswordInput placeholder="Enter secret password" />
              </FormField>

              <FormField label="Error State" error="This field is required and cannot be blank">
                <Input defaultValue="Invalid text" hasError />
              </FormField>

              <FormField label="Textarea">
                <Textarea placeholder="Describe the maintenance requirements..." rows={3} />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selection Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField label="Dropdown Select">
                <Select
                  options={[
                    { value: 'all', label: 'All Categories' },
                    { value: 'plumbing', label: 'Plumbing & Water' },
                    { value: 'electrical', label: 'Electrical & Solar' },
                    { value: 'carpentry', label: 'Carpentry & Woodwork' },
                  ]}
                />
              </FormField>

              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">Checkboxes</p>
                <Checkbox
                  label="Receive notification via SMS and Email"
                  checked={checkboxVal}
                  onChange={(e) => setCheckboxVal(e.target.checked)}
                />
                <Checkbox
                  label="I understand maintenance requires owner verification"
                  description="A certified inspector will be assigned within 24 hours."
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">Radio Group</p>
                <RadioGroup value={radioVal} onChange={setRadioVal}>
                  <Radio value="standard" label="Standard Clean" description="4 hours deep refresh" />
                  <Radio value="turnover" label="Guest Turnover Protocol" description="Full linen swap & inspection" />
                </RadioGroup>
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-sm font-medium text-ink">Toggle Switches</p>
                <Switch
                  label="Instant Booking"
                  description="Allow verified guests to book immediately without manual approval"
                  checked={switchVal}
                  onChange={(e) => setSwitchVal(e.target.checked)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: Feedback & Badges */}
      {activeTab === 'feedback' && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Status Badges & Domain Indicators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-body uppercase tracking-wider mb-2">
                  Booking Statuses
                </p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status="PENDING" type="booking" />
                  <StatusBadge status="CONFIRMED" type="booking" />
                  <StatusBadge status="CHECKED_IN" type="booking" />
                  <StatusBadge status="CHECKED_OUT" type="booking" />
                  <StatusBadge status="CANCELLED" type="booking" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-body uppercase tracking-wider mb-2">
                  Maintenance Job Workflow
                </p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status="OPEN" type="maintenance" />
                  <StatusBadge status="ASSIGNED" type="maintenance" />
                  <StatusBadge status="IN_PROGRESS" type="maintenance" />
                  <StatusBadge status="COMPLETED" type="maintenance" />
                  <StatusBadge status="CANCELLED" type="maintenance" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-body uppercase tracking-wider mb-2">
                  General Badges with Tag Notch
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary" tag>Primary Tag</Badge>
                  <Badge variant="amber" tag>Studio</Badge>
                  <Badge variant="success">Verified Provider</Badge>
                  <Badge variant="warning">Inspection Due</Badge>
                  <Badge variant="danger">High Priority</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prices, Ratings & Avatars</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-baseline gap-6">
                <div>
                  <span className="text-xs text-body block mb-1">Standard Nightly</span>
                  <Price amount="8500.00" period="night" size="lg" />
                </div>
                <div>
                  <span className="text-xs text-body block mb-1">Total Stay (Indian Numbering)</span>
                  <Price amount="1234567.50" size="xl" />
                </div>
                <div>
                  <span className="text-xs text-body block mb-1">Maintenance Expense</span>
                  <Price amount="4200.00" size="md" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-8 pt-4 border-t border-border">
                <div>
                  <span className="text-xs text-body block mb-1">Interactive Rating</span>
                  <Rating value={ratingVal} onChange={setRatingVal} size="lg" />
                </div>
                <div>
                  <span className="text-xs text-body block mb-1">Readonly Star Rating</span>
                  <Rating value={4.8} readonly size="md" />
                </div>
                <div>
                  <span className="text-xs text-body block mb-1">Kolkata Date/Time</span>
                  <DateTime value={new Date().toISOString()} />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-border">
                <Avatar name="Priya Sharma" size="sm" />
                <Avatar name="Aarav Sen" size="md" />
                <Avatar name="Kiran Rao" size="lg" status="online" />
                <Avatar name="Anand Patel" size="xl" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Toast Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addToast({ title: 'Information', message: 'Inspection scheduled for tomorrow morning.', variant: 'info' })}
                >
                  Trigger Info Toast
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addToast({ title: 'Success', message: 'Booking confirmed! Welcome to the space.', variant: 'success' })}
                >
                  Trigger Success Toast
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addToast({ title: 'Warning', message: 'Water heater maintenance is overdue.', variant: 'warning' })}
                >
                  Trigger Warning Toast
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addToast({ title: 'Error', message: 'Unable to process payment. Try again.', variant: 'danger' })}
                >
                  Trigger Danger Toast
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: Modals & Drawers */}
      {activeTab === 'overlays' && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Overlays & Dialogs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Button variant="primary" onClick={() => setModalOpen(true)}>
                  Open Modal
                </Button>
                <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                  Open Drawer
                </Button>
                <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                  Open Confirm Dialog
                </Button>

                <Tooltip content="Verified property badge">
                  <Button variant="ghost">Hover for Tooltip</Button>
                </Tooltip>

                <DropdownMenu
                  trigger={
                    <Button variant="outline" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Dropdown Menu
                    </Button>
                  }
                >
                  <DropdownMenuItem onClick={() => {}}>View Details</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {}}>Assign Provider</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {}} className="text-danger">
                    Cancel Request
                  </DropdownMenuItem>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          {/* Modal Example */}
          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Inspect Space Details"
            description="Property assessment protocol for Villa Nirvana"
          >
            <div className="space-y-4 text-sm text-body">
              <p>
                Every property in the Nexora portfolio undergoes regular structural
                and aesthetic audits to maintain architectural integrity.
              </p>
              <div className="p-4 rounded-xl bg-sand flex items-center justify-between">
                <span className="font-semibold text-ink">Property Health Score</span>
                <Badge variant="success">96 / 100</Badge>
              </div>
            </div>
          </Modal>

          {/* Drawer Example */}
          <Drawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="Inspection Checklist"
            description="Review items before approving release"
          >
            <div className="space-y-4 text-sm text-body">
              <div className="p-3 rounded-lg border border-border">
                <p className="font-semibold text-ink">1. Electrical panel grounding</p>
                <p className="text-xs text-body">Inspected on 20 Nov 2026</p>
              </div>
              <div className="p-3 rounded-lg border border-border">
                <p className="font-semibold text-ink">2. Slate roof water-tightness</p>
                <p className="text-xs text-body">Verified by Master Carpenter</p>
              </div>
            </div>
          </Drawer>

          {/* Confirm Dialog Example */}
          <ConfirmDialog
            isOpen={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false);
              addToast({ title: 'Cancelled', message: 'Maintenance job was cancelled.', variant: 'info' });
            }}
            title="Cancel Maintenance Job?"
            message="Are you sure you want to cancel this maintenance request? The assigned technician will be notified."
            confirmLabel="Confirm Cancellation"
            variant="danger"
          />
        </div>
      )}

      {/* TAB 6: Data & Navigation */}
      {activeTab === 'data' && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Breadcrumbs & Steppers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Breadcrumbs
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Spaces', href: '/explore' },
                  { label: 'Goa', href: '/explore?region=goa' },
                  { label: 'Villa Nirvana Estate' },
                ]}
              />

              <div className="pt-4 border-t border-border">
                <Stepper
                  steps={[
                    { title: 'Dates & Guests', description: 'Select duration' },
                    { title: 'Personal Details', description: 'Steward contact' },
                    { title: 'Confirmation', description: 'Review & escrow' },
                  ]}
                  currentStep={stepperStep}
                  onStepClick={setStepperStep}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagination</CardTitle>
            </CardHeader>
            <CardContent>
              <Pagination
                currentPage={currentPage}
                totalPages={8}
                onPageChange={setCurrentPage}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <EmptyState
              title="No maintenance jobs found"
              description="All systems in this space are operating in pristine condition."
              actionLabel="Request Service"
              onAction={() => addToast({ title: 'Action', message: 'Navigating to request service', variant: 'info' })}
            />

            <ErrorState
              title="Unable to load financial statements"
              message="The server did not respond within the expected threshold. Please try again."
              onRetry={() => addToast({ title: 'Retrying', message: 'Fetching latest statements...', variant: 'info' })}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Skeleton Loaders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton variant="circle" className="w-12 h-12" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-32 w-full rounded-2xl" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
