import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadCsv } from '@/lib/export';
import { Download, Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api-config';

const DepartmentsPage = () => {
  const [departments, setDepartments] = useState<{ id: string; name: string; created_at: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editDepartmentId, setEditDepartmentId] = useState<string | null>(null);
  const [name, setName] = useState('');

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_URL}/departments`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDepartments(data || []);
    } catch (err) {
      console.error('Failed to fetch departments', err);
      toast.error('Failed to load departments');
    }
  };

  useEffect(() => { fetchDepartments(); }, []);

  const resetForm = () => {
    setOpen(false);
    setEditDepartmentId(null);
    setName('');
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    const token = localStorage.getItem('auth_token');
    
    try {
      if (editDepartmentId) {
        const res = await fetch(`${API_URL}/departments/${editDepartmentId}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: name.trim() })
        });
        if (!res.ok) throw new Error('Failed to update');
        toast.success('Department updated');
      } else {
        const res = await fetch(`${API_URL}/departments`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: name.trim() })
        });
        if (!res.ok) throw new Error('Failed to create');
        toast.success('Department created');
      }
      resetForm();
      fetchDepartments();
    } catch (err) {
      toast.error(editDepartmentId ? 'Failed to update department' : 'Failed to create department');
    }
  };

  const handleDelete = async (id: string) => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_URL}/departments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Department deleted');
      fetchDepartments();
    } catch (err) {
      toast.error('Failed to delete department');
    }
  };

  const handleEdit = (department: { id: string; name: string }) => {
    setEditDepartmentId(department.id);
    setName(department.name);
    setOpen(true);
  };

  const handleExport = () => {
    downloadCsv('departments.csv', departments.map((department) => ({
      Name: department.name,
      CreatedAt: new Date(department.created_at).toLocaleString(),
    })));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold">Departments</h2>
            <p className="text-muted-foreground">Manage clinic departments</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={departments.length === 0}>
              <Download className="mr-2 h-4 w-4" />Export
            </Button>
            <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Department</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editDepartmentId ? 'Edit Department' : 'Add Department'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Department Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cardiology" />
                </div>
                <Button onClick={handleCreate} className="w-full">{editDepartmentId ? 'Update Department' : 'Create Department'}</Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(d)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {departments.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No departments</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DepartmentsPage;

