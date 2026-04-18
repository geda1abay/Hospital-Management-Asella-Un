import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Download, FlaskConical, Edit, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatBirr } from '@/lib/currency';

import { API_URL } from '@/lib/api-config';

const LabDashboard = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  
  const [resultNote, setResultNote] = useState('');
  const [cost, setCost] = useState('');

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const [reqRes, patRes, docRes] = await Promise.all([
        fetch(`${API_URL}/lab_requests`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/patients`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/profiles`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      
      const [reqData, patData, docData] = await Promise.all([
        reqRes.json(),
        patRes.json(),
        docRes.json(),
      ]);

      setRequests(reqData || []);
      setPatients(patData || []);
      setDoctors(docData || []);
    } catch (err) {
      console.error('Failed to fetch lab data', err);
      toast.error('Failed to load lab requests');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async () => {
    if (!selectedRequest) return;
    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch(`${API_URL}/lab_requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(
          selectedRequest.payment_status === 'paid' 
          ? {
              result_note: resultNote,
              cost_birr: parseFloat(cost) || 0,
              status: 'completed'
            }
          : {
              cost_birr: parseFloat(cost) || 0
            }
        )
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(selectedRequest.payment_status === 'paid' ? 'Lab results and cost recorded' : 'Cost updated and sent to Admin');
      setEditOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to save data');
    }
  };

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name || 'Unknown';
  const getDoctorName = (id: string) => doctors.find(d => d.user_id === id)?.full_name || 'Unknown';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold">Laboratory Dashboard</h2>
            <p className="text-muted-foreground">Manage medical test requests and results</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1">
              <FlaskConical className="mr-2 h-4 w-4 text-primary" />
              {requests.filter(r => r.status === 'pending').length} Pending Requests
            </Badge>
          </div>
        </div>

        <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Test Description</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} className="group border-b border-border/50">
                    <TableCell className="font-medium">{getPatientName(request.patient_id)}</TableCell>
                    <TableCell>{getDoctorName(request.doctor_id)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{request.test_description}</TableCell>
                    <TableCell>{formatBirr(Number(request.cost_birr))}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={request.payment_status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                        {request.payment_status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={request.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}>
                        {request.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedRequest(request);
                          setResultNote(request.result_note || '');
                          setCost(String(request.cost_birr || ''));
                          setEditOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      No lab requests found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                Laboratory Test Entry
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-medium">{getPatientName(selectedRequest?.patient_id)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested Test:</span>
                  <span className="font-medium truncate max-w-[250px]">{selectedRequest?.test_description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Status:</span>
                  <Badge variant="secondary" className={selectedRequest?.payment_status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                    {selectedRequest?.payment_status?.toUpperCase() || 'PENDING'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cost">Billing Amount (Birr)</Label>
                  <div className="relative">
                    <Input 
                      id="cost"
                      type="number" 
                      value={cost} 
                      onChange={(e) => setCost(e.target.value)} 
                      placeholder="Enter amount to be paid at Admin"
                      className="pl-4"
                      disabled={selectedRequest?.payment_status?.toLowerCase() === 'paid'}
                      readOnly={selectedRequest?.payment_status?.toLowerCase() === 'paid'}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">This amount will be sent to the Admin dashboard for payment.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Test Results / Notes</Label>
                  {selectedRequest?.payment_status === 'pending' ? (
                    <div className="p-4 border rounded-md bg-muted/30 text-muted-foreground text-sm flex items-center justify-center min-h-[150px]">
                      Waiting for patient to pay at Admin. You cannot enter results yet.
                    </div>
                  ) : (
                    <Textarea 
                      id="notes"
                      value={resultNote} 
                      onChange={(e) => setResultNote(e.target.value)} 
                      placeholder="Enter detailed test results for the specialist doctor..."
                      className="min-h-[150px] resize-none"
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleUpdate}>
                  <CheckCircle className="mr-2 h-4 w-4" /> 
                  {selectedRequest?.payment_status === 'paid' ? 'Save & Complete' : 'Update Cost'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default LabDashboard;
