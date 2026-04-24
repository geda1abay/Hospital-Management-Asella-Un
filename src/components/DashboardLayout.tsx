import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, UserPlus, Building2, FileText, CreditCard,
  Stethoscope, ClipboardList, Menu, X, LogOut, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Doctors', href: '/admin/doctors', icon: Stethoscope },
  { label: 'Patients', href: '/admin/patients', icon: Users },
  { label: 'Departments', href: '/admin/departments', icon: Building2 },
  { label: 'Services', href: '/admin/services', icon: ClipboardList },
  { label: 'Bills', href: '/admin/bills', icon: FileText },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard },
];

const generalDoctorNav: NavItem[] = [
  { label: 'My Patients', href: '/doctor/general', icon: Users },
  { label: 'Diagnoses', href: '/doctor/general/diagnoses', icon: ClipboardList },
];

const specialistDoctorNav: NavItem[] = [
  { label: 'Referred Patients', href: '/doctor/specialist', icon: Users },
  { label: 'Treatments', href: '/doctor/specialist/treatments', icon: ClipboardList },
  { label: 'Billing', href: '/doctor/specialist/billing', icon: FileText },
];

const laboratoryNav: NavItem[] = [
  { label: 'Lab Dashboard', href: '/laboratory/dashboard', icon: Stethoscope },
];

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = role === 'admin' 
    ? adminNav 
    : role === 'general_doctor' 
    ? generalDoctorNav 
    : role === 'specialist_doctor'
    ? specialistDoctorNav
    : laboratoryNav;

  const roleLabel = role === 'admin' 
    ? 'Administrator' 
    : role === 'general_doctor' 
    ? 'General Doctor' 
    : role === 'specialist_doctor'
    ? 'Specialist Doctor'
    : 'Laboratory Technician';

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Stethoscope className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-heading text-lg font-bold text-sidebar-foreground">Geda Clinic</span>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {active && <ChevronRight className="ml-auto h-4 w-4" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="px-3">
            <p className="text-sm font-medium text-sidebar-foreground">{profile?.full_name}</p>
            <p className="text-xs text-sidebar-foreground/60">{roleLabel}</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-border bg-card px-4 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="ml-4 lg:ml-0">
            <h1 className="font-heading text-lg font-semibold text-foreground">
              {navItems.find((n) => n.href === location.pathname)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="ml-auto">
            <Button variant="outline" className="gap-2" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
