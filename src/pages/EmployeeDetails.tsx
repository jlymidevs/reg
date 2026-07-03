import { Phone, Mail, MapPin, Globe, Link, FileText, Download, MoreHorizontal } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatRing } from '../components/ui/StatRing';

export function EmployeeDetails() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Column - Profile */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col items-center pt-8">
              <img 
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
                alt="Mia Torres" 
                className="w-24 h-24 rounded-2xl object-cover mb-4 shadow-sm"
              />
              <h2 className="text-xl font-bold text-secondary">Mia Torres</h2>
              <p className="text-sm text-muted mb-4">HR Officer • Human Resources</p>
              
              <div className="flex gap-2 mb-8">
                <Badge variant="neutral">EMP-2201</Badge>
                <Badge variant="success">Active</Badge>
              </div>

              <div className="w-full space-y-4 text-sm border-t border-border/50 pt-6">
                <div className="flex justify-between">
                  <span className="text-muted">Employment Type</span>
                  <span className="font-semibold text-secondary">Full-Time</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Work Model</span>
                  <span className="font-semibold text-secondary">Hybrid</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Join Date</span>
                  <span className="font-semibold text-secondary">11 February 2022</span>
                </div>
              </div>

              <div className="w-full flex items-center justify-between mt-8 pt-6 border-t border-border/50">
                <span className="text-sm text-muted">Social Media:</span>
                <div className="flex gap-2 text-primary">
                  <button className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"><Link className="w-4 h-4" /></button>
                  <button className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"><Globe className="w-4 h-4" /></button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-secondary mb-4">Personal Info</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted">Address</p>
                    <p className="text-sm font-medium text-secondary">Jl. Melati No. 45, Sleman,<br/>Yogyakarta, Indonesia</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted">Email Address</p>
                    <p className="text-sm font-medium text-secondary">mia.torres@company.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted">Phone</p>
                    <p className="text-sm font-medium text-secondary">+62 812-3456-7890</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Stats & Content */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          {/* Leaves */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-6">
                <StatRing value={14} max={20} label="All Leaves" subLabel="/20" color="text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-6">
                <StatRing value={10} max={12} label="Annual Leaves" subLabel="/12" color="text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-6">
                <StatRing value={3} max={5} label="Casual Leaves" subLabel="/5" color="text-secondary" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-6">
                <StatRing value={1} max={3} label="Sick Leaves" subLabel="/3" color="text-secondary" />
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-semibold text-secondary">Performance Overview</h3>
                    <div className="flex items-end gap-2 mt-2">
                      <span className="text-3xl font-bold text-secondary">86.75%</span>
                      <span className="text-sm text-primary mb-1 flex items-center">↑ 12.5%</span>
                    </div>
                  </div>
                  <select className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-muted focus:outline-none">
                    <option>Last Year</option>
                  </select>
                </div>
                {/* SVG Chart Placeholder */}
                <div className="flex-1 mt-4 relative min-h-[120px]">
                  <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <path d="M0,35 Q10,25 20,28 T40,15 T60,20 T80,5 T100,10" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
                    <circle cx="80" cy="5" r="2" fill="currentColor" className="text-primary" />
                  </svg>
                  <div className="flex justify-between text-xs text-muted mt-4">
                    <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-semibold text-secondary">Hours Logged</h3>
                    <div className="flex items-end gap-2 mt-2">
                      <span className="text-3xl font-bold text-secondary">34<span className="text-xl">h</span> 30<span className="text-xl">m</span></span>
                    </div>
                  </div>
                  <select className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-muted focus:outline-none">
                    <option>This Week</option>
                  </select>
                </div>
                {/* Bar Chart */}
                <div className="flex-1 flex items-end justify-between gap-2 mt-4 pt-4 border-t border-border/50">
                  {[40, 60, 50, 80, 100, 20, 10].map((h, i) => (
                    <div key={i} className="w-full flex flex-col items-center gap-2">
                      <div className="w-full bg-primary/20 rounded-t-sm" style={{ height: `100px` }}>
                        <div className="w-full bg-primary rounded-t-sm transition-all" style={{ height: `${h}%`, marginTop: `${100 - h}px` }}></div>
                      </div>
                      <span className="text-xs text-muted">{'MTWTFSS'[i]}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-secondary">Documents</h3>
                  <button className="text-muted hover:text-secondary"><MoreHorizontal className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  {[
                    { name: 'Performance Evaluation.pdf', size: '1.24 MB' },
                    { name: 'Contract Agreement.pdf', size: '865 KB' },
                    { name: 'Curriculum Vitae.pdf', size: '1.24 MB' }
                  ].map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-background transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-error/10 text-error rounded-lg">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-secondary">{doc.name}</p>
                          <p className="text-xs text-muted">PDF • {doc.size}</p>
                        </div>
                      </div>
                      <button className="text-muted hover:text-primary"><Download className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-secondary">Payroll Summary</h3>
                  <button className="text-muted hover:text-secondary"><MoreHorizontal className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between pb-2 border-b border-border/50">
                    <span className="text-muted">Basic Salary</span>
                    <span className="font-medium text-secondary">$3,200</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-border/50">
                    <span className="text-muted">Transportation</span>
                    <span className="font-medium text-secondary">$120</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-border/50">
                    <span className="text-muted">Meal</span>
                    <span className="font-medium text-secondary">$110</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-border/50">
                    <span className="text-muted">Health Insurance</span>
                    <span className="font-medium text-secondary">$120</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="font-semibold text-secondary">Total Monthly Value</span>
                    <span className="font-bold text-primary">$3,550</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
