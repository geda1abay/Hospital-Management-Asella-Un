import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBirr } from '@/lib/currency';
import { downloadCsv } from '@/lib/export';
import { Check, Download, Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api-config';

const PaymentsPage = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [labRequests, setLabRequests] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<any | null>(null);
  const [form, setForm] = useState({ bill_id: '', amount: '', method: 'cash', reference_number: '', status: 'completed' });

  const fetchData = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const [payRes, billRes, patRes, labRes] = await Promise.all([
        fetch(`${API_URL}/payments`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/bills`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/patients`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/lab_requests`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      
      const [payData, billData, patData, labData] = await Promise.all([
        payRes.json(),
        billRes.json(),
        patRes.json(),
        labRes.json(),
      ]);

      setPatients(patData || []);
      setLabRequests(labData || []);

      const billsWithNames = (billData || []).map((bill: any) => ({
        ...bill,
        patient_name: (patData || []).find((patient: any) => patient.id === bill.patient_id)?.name,
      }));
      setBills(billsWithNames);
      setPayments((payData || []).map((payment: any) => ({
        ...payment,
        bill: billsWithNames.find((bill: any) => bill.id === payment.bill_id),
      })));
    } catch (err) {
      console.error('Failed to fetch payments data', err);
      toast.error('Failed to load records');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setOpen(false);
    setEditPayment(null);
    setForm({ bill_id: '', amount: '', method: 'cash', reference_number: '', status: 'completed' });
  };

  const handleSave = async () => {
    const token = localStorage.getItem('auth_token');
    const payload = {
      bill_id: form.bill_id,
      amount: parseFloat(form.amount),
      method: form.method,
      reference_number: form.reference_number || null,
      status: form.status,
    };

    try {
      const url = editPayment ? `${API_URL}/payments/${editPayment.id}` : `${API_URL}/payments`;
      const method = editPayment ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to save');

      toast.success(editPayment ? 'Payment updated' : 'Payment recorded');
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(editPayment ? 'Failed to update payment' : 'Failed to record payment');
    }
  };

  const handleProcessLabPayment = async (requestId: string) => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_URL}/lab_requests/${requestId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ payment_status: 'paid' })
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Lab payment recorded');
      fetchData();
    } catch (err) {
      toast.error('Failed to record lab payment');
    }
  };

  const handleEdit = (payment: any) => {
    setEditPayment(payment);
    setForm({
      bill_id: payment.bill_id,
      amount: String(payment.amount),
      method: payment.method,
      reference_number: payment.reference_number || '',
      status: payment.status,
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_URL}/payments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Payment deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete payment');
    }
  };

  const handleExport = () => {
    downloadCsv('payments.csv', payments.map((payment) => ({
      Patient: payment.bill?.patient_name || '-',
      Amount: formatBirr(Number(payment.amount)),
      Method: payment.method,
      Status: payment.status,
      Reference: payment.reference_number || '-',
      Date: new Date(payment.created_at).toLocaleString(),
    })));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold">Payments & Billing</h2>
            <p className="text-muted-foreground">Manage clinic bills and laboratory payments</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={payments.length === 0}>
              <Download className="mr-2 h-4 w-4" />Export
            </Button>
            <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Record Bill Payment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editPayment ? 'Edit Payment' : 'Record Payment'}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bill</Label>
                    <Select value={form.bill_id} onValueChange={(value) => setForm({ ...form, bill_id: value })} disabled={Boolean(editPayment)}>
                      <SelectTrigger><SelectValue placeholder="Select bill" /></SelectTrigger>
                      <SelectContent>
                        {bills.filter((bill) => bill.status !== 'paid' || bill.id === form.bill_id).map((bill) => (
                          <SelectItem key={bill.id} value={bill.id}>
                            {bill.patient_name} - {formatBirr(Number(bill.final_amount))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (Birr)</Label>
                    <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={form.method} onValueChange={(value) => setForm({ ...form, method: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="mobile">Mobile Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference Number (optional)</Label>
                    <Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
                  </div>
                  <Button onClick={handleSave} className="w-full">{editPayment ? 'Update Payment' : 'Record Payment'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="hospital" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-[500px]">
            <TabsTrigger value="hospital">Clinic Bills</TabsTrigger>
            <TabsTrigger value="lab">Lab Payments</TabsTrigger>
            <TabsTrigger value="history">Transaction History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="hospital" className="pt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Final Cost (after discount)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.patient_name}</TableCell>
                        <TableCell>{formatBirr(Number(b.total_amount))}</TableCell>
                        <TableCell className="font-bold">{formatBirr(Number(b.final_amount))}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={b.status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                            {b.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {b.status !== 'paid' && (
                            <Button size="sm" onClick={() => { 
                               setEditPayment(null);
                               setForm({ bill_id: b.id, amount: String(b.final_amount), method: 'cash', reference_number: '', status: 'completed' });
                               setOpen(true); 
                            }}>
                              <Check className="mr-1 h-3 w-3" /> Record Payment
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {bills.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No clinic bills found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.bill?.patient_name || '-'}</TableCell>
                        <TableCell>{formatBirr(Number(payment.amount))}</TableCell>
                        <TableCell className="capitalize">{payment.method}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-success/10 text-success">{payment.status}</Badge>
                        </TableCell>
                        <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(payment)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(payment.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {payments.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payments</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lab" className="pt-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Test</TableHead>
                        <TableHead>Cost (Birr)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {labRequests.filter(r => r.cost_birr > 0).map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{patients.find(p => p.id === request.patient_id)?.name || 'Unknown'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{request.test_description}</TableCell>
                          <TableCell className="font-bold">{formatBirr(Number(request.cost_birr))}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={request.payment_status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                              {request.payment_status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {request.payment_status === 'pending' && (
                              <Button size="sm" onClick={() => handleProcessLabPayment(request.id)}>
                                <Check className="mr-1 h-3 w-3" /> Record Payment
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {labRequests.filter(r => r.cost_birr > 0).length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No lab billings</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PaymentsPage;


