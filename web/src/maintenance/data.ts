import type {
  ActivityEvent, AppSettings, Asset, Attachment, Contractor, Estimate, Expense,
  Lease, MaintenanceRequest, PreventiveSchedule, Project, Property, StaffMember,
  Tenant, Unit, Visit, WorkLogEntry, WorkOrder,
} from './types';
import { dOff, dtOff } from './utils';

export const CURRENT_USER: StaffMember = { id: 'S1', name: 'Alex Morgan', role: 'Property Manager' };

export interface SeedData {
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  staff: StaffMember[];
  contractors: Contractor[];
  requests: MaintenanceRequest[];
  estimates: Estimate[];
  visits: Visit[];
  workLogs: WorkLogEntry[];
  workOrders: WorkOrder[];
  assets: Asset[];
  expenses: Expense[];
  schedules: PreventiveSchedule[];
  attachments: Attachment[];
  activity: ActivityEvent[];
  projects: Project[];
  settings: AppSettings;
}

const Y = new Date().getFullYear();
const MR = (n: number) => `MR-${Y}-${String(n).padStart(4, '0')}`;

export function buildSeed(): SeedData {
  const properties: Property[] = [
    { id: 'P1', name: 'Maple Court Apartments', address: '48 Maple Avenue', city: 'Austin, TX 78704', type: 'Multi-Family', yearBuilt: 1998 },
    { id: 'P2', name: 'Riverside Duplex', address: '112 Riverside Drive', city: 'Austin, TX 78741', type: 'Duplex', yearBuilt: 2005 },
    { id: 'P3', name: 'Oakwood Townhomes', address: '720 Oakwood Lane', city: 'Round Rock, TX 78664', type: 'Townhomes', yearBuilt: 2012 },
    { id: 'P4', name: 'Hillcrest House', address: '9 Hillcrest Road', city: 'Austin, TX 78746', type: 'Single-Family', yearBuilt: 1987 },
  ];

  const units: Unit[] = [
    { id: 'U1', propertyId: 'P1', name: 'Unit 1', beds: 2, baths: 1, sqft: 850, status: 'Occupied' },
    { id: 'U2', propertyId: 'P1', name: 'Unit 2', beds: 2, baths: 1, sqft: 850, status: 'Occupied' },
    { id: 'U3', propertyId: 'P1', name: 'Unit 3', beds: 3, baths: 2, sqft: 1100, status: 'Occupied' },
    { id: 'U4', propertyId: 'P1', name: 'Unit 4', beds: 2, baths: 1, sqft: 875, status: 'Occupied' },
    { id: 'U5', propertyId: 'P1', name: 'Unit 5', beds: 1, baths: 1, sqft: 640, status: 'Occupied' },
    { id: 'U6', propertyId: 'P1', name: 'Unit 6', beds: 2, baths: 2, sqft: 980, status: 'Vacant' },
    { id: 'U7', propertyId: 'P2', name: 'Unit A', beds: 3, baths: 2, sqft: 1250, status: 'Occupied' },
    { id: 'U8', propertyId: 'P2', name: 'Unit B', beds: 3, baths: 2, sqft: 1250, status: 'Occupied' },
    { id: 'U9', propertyId: 'P3', name: 'TH-1', beds: 3, baths: 2.5, sqft: 1420, status: 'Vacant' },
    { id: 'U10', propertyId: 'P3', name: 'TH-2', beds: 3, baths: 2.5, sqft: 1420, status: 'Occupied' },
    { id: 'U11', propertyId: 'P3', name: 'TH-3', beds: 2, baths: 2, sqft: 1180, status: 'Notice Given' },
    { id: 'U12', propertyId: 'P3', name: 'TH-4', beds: 3, baths: 2.5, sqft: 1450, status: 'Occupied' },
    { id: 'U13', propertyId: 'P4', name: 'Main House', beds: 4, baths: 3, sqft: 2200, status: 'Occupied' },
  ];

  const tenants: Tenant[] = [
    { id: 'T1', name: 'Sarah Mitchell', email: 'sarah.mitchell@email.com', phone: '(512) 555-0142', movedIn: '2023-06-01' },
    { id: 'T2', name: 'David Chen', email: 'd.chen@email.com', phone: '(512) 555-0198', movedIn: '2022-09-15' },
    { id: 'T3', name: 'Maria Garcia', email: 'maria.garcia@email.com', phone: '(512) 555-0117', movedIn: '2024-01-10' },
    { id: 'T4', name: 'James Wilson', email: 'jwilson@email.com', phone: '(512) 555-0163', movedIn: '2023-03-01' },
    { id: 'T5', name: 'Emily Johnson', email: 'emily.j@email.com', phone: '(512) 555-0129', movedIn: '2024-07-01' },
    { id: 'T6', name: 'Michael Brown', email: 'mbrown@email.com', phone: '(512) 555-0175', movedIn: '2021-11-01' },
    { id: 'T7', name: 'Anna Kowalski', email: 'anna.k@email.com', phone: '(512) 555-0134', movedIn: '2023-08-15' },
    { id: 'T8', name: 'Robert Taylor', email: 'rtaylor@email.com', phone: '(512) 555-0181', movedIn: '2022-05-01' },
    { id: 'T9', name: 'Lisa Anderson', email: 'lisa.anderson@email.com', phone: '(512) 555-0156', movedIn: '2020-10-01' },
    { id: 'T10', name: 'Kevin Park', email: 'kevin.park@email.com', phone: '(512) 555-0108', movedIn: '2024-02-01' },
  ];

  const leases: Lease[] = [
    { id: 'L1', unitId: 'U1', tenantId: 'T1', start: '2023-06-01', end: dOff(140), rent: 1450, status: 'Active' },
    { id: 'L2', unitId: 'U2', tenantId: 'T2', start: '2022-09-15', end: dOff(220), rent: 1450, status: 'Active' },
    { id: 'L3', unitId: 'U3', tenantId: 'T3', start: '2024-01-10', end: dOff(35), rent: 1750, status: 'Expiring Soon' },
    { id: 'L4', unitId: 'U4', tenantId: 'T4', start: '2023-03-01', end: dOff(180), rent: 1475, status: 'Active' },
    { id: 'L5', unitId: 'U5', tenantId: 'T5', start: '2024-07-01', end: dOff(160), rent: 1150, status: 'Active' },
    { id: 'L6', unitId: 'U7', tenantId: 'T6', start: '2021-11-01', end: dOff(90), rent: 1950, status: 'Active' },
    { id: 'L7', unitId: 'U8', tenantId: 'T7', start: '2023-08-15', end: dOff(200), rent: 1950, status: 'Active' },
    { id: 'L8', unitId: 'U10', tenantId: 'T8', start: '2022-05-01', end: dOff(75), rent: 2100, status: 'Active' },
    { id: 'L9', unitId: 'U13', tenantId: 'T9', start: '2020-10-01', end: dOff(300), rent: 2800, status: 'Active' },
    { id: 'L10', unitId: 'U12', tenantId: 'T10', start: '2024-02-01', end: dOff(45), rent: 2150, status: 'Expiring Soon' },
  ];

  const staff: StaffMember[] = [
    CURRENT_USER,
    { id: 'S2', name: 'Jamie Lee', role: 'Maintenance Coordinator' },
    { id: 'S3', name: 'Sam Ortiz', role: 'In-House Technician' },
    { id: 'S4', name: 'Priya Nair', role: 'Assistant Manager' },
  ];

  const contractors: Contractor[] = [
    { id: 'C1', company: 'ProFlow Plumbing', contact: 'Mike Delgado', phone: '(512) 555-0210', email: 'dispatch@proflowplumbing.com', categories: ['Plumbing'], active: true, notes: '24/7 emergency line. Net-30 terms.' },
    { id: 'C2', company: 'CoolAir HVAC Services', contact: 'Tina Brooks', phone: '(512) 555-0224', email: 'service@coolairhvac.com', categories: ['Heating, Ventilation & Air Conditioning'], active: true, notes: 'Carrier & Trane authorized dealer.' },
    { id: 'C3', company: 'FixIt Appliance Repair', contact: 'Hassan Ali', phone: '(512) 555-0237', email: 'bookings@fixitappliance.com', categories: ['Appliance'], active: true, notes: '$65 diagnosis fee waived with repair.' },
    { id: 'C4', company: 'SparkRight Electric', contact: 'Dan Whitaker', phone: '(512) 555-0241', email: 'dan@sparkright.com', categories: ['Electrical'], active: true },
    { id: 'C5', company: 'HandyWorks General Contracting', contact: 'Carlos Mendez', phone: '(512) 555-0255', email: 'carlos@handyworks.com', categories: ['General Repairs', 'Painting', 'Flooring', 'Doors and Windows'], active: true, notes: 'Preferred for unit turnovers.' },
    { id: 'C6', company: 'SafeHome Pest Control', contact: 'Erin Walsh', phone: '(512) 555-0268', email: 'erin@safehomepest.com', categories: ['Pest Control'], active: true },
    { id: 'C7', company: 'Apex Roofing Co.', contact: 'Tom Becker', phone: '(512) 555-0273', email: 'tom@apexroofing.com', categories: ['Roofing'], active: false, notes: 'Inactive — replaced by HandyWorks for minor repairs.' },
  ];

  const assets: Asset[] = [
    {
      id: 'AST-101', name: 'Kitchen Refrigerator', type: 'Refrigerator', propertyId: 'P1', unitId: 'U2', room: 'Kitchen',
      brand: 'LG', model: 'LRFXS2503S', serial: '905KRCX44712', purchaseDate: '2019-05-14', purchasePrice: 1149,
      supplier: 'ApplianceWorld', installDate: '2019-05-20', warrantyStart: '2019-05-14', warrantyEnd: '2021-05-14',
      warrantyProvider: 'LG Manufacturer Warranty', warrantyRef: 'LG-W-884120', warrantyNotes: '2-year parts & labor (expired). Sealed system 5 years (expired).',
      condition: 'Poor', status: 'Under Repair', lastService: dOff(-200), lastInspection: dOff(-96),
    },
    {
      id: 'AST-102', name: 'Kitchen Dishwasher', type: 'Dishwasher', propertyId: 'P1', unitId: 'U4', room: 'Kitchen',
      brand: 'Bosch', model: 'SHX3AR75UC', serial: 'FD970501188', purchaseDate: '2017-09-02', purchasePrice: 649,
      supplier: 'Home Depot', installDate: '2017-09-09', warrantyStart: '2017-09-02', warrantyEnd: '2019-09-02',
      warrantyProvider: 'Bosch', warrantyRef: 'BSH-55213', condition: 'Fair', status: 'Under Inspection',
      lastService: dOff(-410), lastInspection: dOff(-96),
    },
    {
      id: 'AST-103', name: 'Laundry Washing Machine', type: 'Washer', propertyId: 'P1', unitId: 'U2', room: 'Laundry Closet',
      brand: 'Samsung', model: 'WA45H7000AW', serial: '0A9J5DBH901274', purchaseDate: '2016-11-20', purchasePrice: 549,
      supplier: 'Lowe’s', installDate: '2016-11-25', warrantyStart: '2016-11-20', warrantyEnd: '2017-11-20',
      warrantyProvider: 'Samsung', condition: 'Poor', status: 'Active', lastService: dOff(-180),
    },
    {
      id: 'AST-104', name: 'Gas Furnace', type: 'Furnace', propertyId: 'P1', unitId: 'U3', room: 'Utility Closet',
      brand: 'Carrier', model: 'Performance 59TP6', serial: '3821A10447', purchaseDate: '2021-10-05', purchasePrice: 3850,
      supplier: 'CoolAir HVAC Services', installDate: '2021-10-12', warrantyStart: '2021-10-12', warrantyEnd: '2031-10-12',
      warrantyProvider: 'Carrier', warrantyRef: 'CAR-10YR-4471', warrantyNotes: '10-year parts warranty. Labor not included. Annual service required to keep warranty valid.',
      condition: 'Good', status: 'Active', lastService: dOff(-353), nextService: dOff(12), lastInspection: dOff(-120),
    },
    {
      id: 'AST-105', name: 'Water Heater (50 gal)', type: 'Water Heater', propertyId: 'P2', unitId: 'U7', room: 'Garage Utility',
      brand: 'Rheem', model: 'PROG50-38N RH60', serial: 'Q041912388', purchaseDate: dOff(-1730), purchasePrice: 920,
      supplier: 'ProFlow Plumbing', installDate: dOff(-1722), warrantyStart: dOff(-1730), warrantyEnd: dOff(64),
      warrantyProvider: 'Rheem', warrantyRef: 'RH-6YR-12388', warrantyNotes: '6-year tank & parts warranty — expiring soon.',
      condition: 'Fair', status: 'Under Repair', lastService: dOff(-300), nextService: dOff(40),
    },
    {
      id: 'AST-106', name: 'Central Air Conditioner', type: 'Air Conditioner', propertyId: 'P3', unitId: 'U10', room: 'Exterior / Attic Air Handler',
      brand: 'Trane', model: 'XR14 4TTR4048', serial: '19334KR52F', purchaseDate: '2020-06-22', purchasePrice: 4600,
      supplier: 'CoolAir HVAC Services', installDate: '2020-06-29', warrantyStart: '2020-06-29', warrantyEnd: '2030-06-29',
      warrantyProvider: 'Trane', warrantyRef: 'TRN-88120', condition: 'Good', status: 'Active',
      lastService: dOff(-47), nextService: dOff(150),
    },
    {
      id: 'AST-107', name: 'Electric Range / Oven', type: 'Stove / Oven', propertyId: 'P1', unitId: 'U1', room: 'Kitchen',
      brand: 'GE', model: 'JB645RKSS', serial: 'DL221388Q', purchaseDate: '2020-02-11', purchasePrice: 729,
      supplier: 'ApplianceWorld', installDate: '2020-02-15', warrantyStart: '2020-02-11', warrantyEnd: '2021-02-11',
      warrantyProvider: 'GE Appliances', condition: 'Good', status: 'Active', lastService: dOff(-500),
    },
    {
      id: 'AST-108', name: 'Laundry Dryer', type: 'Dryer', propertyId: 'P1', unitId: 'U2', room: 'Laundry Closet',
      brand: 'Whirlpool', model: 'WED4815EW', serial: 'M70122984', purchaseDate: '2018-04-03', purchasePrice: 479,
      supplier: 'Lowe’s', installDate: '2018-04-07', warrantyStart: '2018-04-03', warrantyEnd: '2019-04-03',
      warrantyProvider: 'Whirlpool', condition: 'Fair', status: 'Active', lastService: dOff(-380), nextService: dOff(-15),
    },
    {
      id: 'AST-109', name: 'Kitchen Refrigerator (Original)', type: 'Refrigerator', propertyId: 'P2', unitId: 'U8', room: 'Kitchen',
      brand: 'Samsung', model: 'RF26J7500SR', serial: '0AZG43BH600198', purchaseDate: '2016-08-19', purchasePrice: 1399,
      supplier: 'Best Buy', installDate: '2016-08-24', warrantyStart: '2016-08-19', warrantyEnd: '2018-08-19',
      warrantyProvider: 'Samsung', condition: 'Failed', status: 'Replaced', replacedById: 'AST-110',
      replacementDate: dOff(-30), replacementReason: 'Compressor failure. Repair estimate $780 approached replacement cost for a 9-year-old unit.',
      retiredDate: dOff(-30), disposalNotes: 'Old unit hauled away by ApplianceWorld (EPA refrigerant recovery certified).',
      lastService: dOff(-33),
    },
    {
      id: 'AST-110', name: 'Kitchen Refrigerator', type: 'Refrigerator', propertyId: 'P2', unitId: 'U8', room: 'Kitchen',
      brand: 'Frigidaire', model: 'Gallery GRFS2853AF', serial: '4A35107712', purchaseDate: dOff(-31), purchasePrice: 1299,
      supplier: 'ApplianceWorld', installDate: dOff(-30), warrantyStart: dOff(-31), warrantyEnd: dOff(699),
      warrantyProvider: 'Frigidaire / Electrolux', warrantyRef: 'FRG-W-77120', warrantyNotes: '1-year full + 2-year extended parts & labor (purchased).',
      condition: 'Excellent', status: 'Active', replacedFromId: 'AST-109', nextService: dOff(334),
    },
    {
      id: 'AST-111', name: 'Sump Pump', type: 'Sump Pump', propertyId: 'P4', unitId: 'U13', room: 'Basement',
      brand: 'Zoeller', model: 'M53 Mighty-Mate', serial: 'K19-0088123', purchaseDate: '2021-03-30', purchasePrice: 289,
      supplier: 'ProFlow Plumbing', installDate: '2021-04-02', warrantyStart: '2021-03-30', warrantyEnd: '2024-03-30',
      warrantyProvider: 'Zoeller', condition: 'Good', status: 'Active', lastService: dOff(-160), nextService: dOff(20),
    },
    {
      id: 'AST-112', name: 'Garage Door Opener', type: 'Garage Door Opener', propertyId: 'P4', unitId: 'U13', room: 'Garage',
      brand: 'Chamberlain', model: 'B970', serial: '041A7723-9', purchaseDate: '2019-12-06', purchasePrice: 329,
      supplier: 'Home Depot', installDate: '2019-12-14', warrantyStart: '2019-12-06', warrantyEnd: '2024-12-06',
      warrantyProvider: 'Chamberlain', warrantyNotes: 'Lifetime motor warranty; parts 5 years (expired).',
      condition: 'Fair', status: 'Active', lastService: dOff(-4),
    },
    {
      id: 'AST-113', name: 'Over-Range Microwave', type: 'Microwave', propertyId: 'P3', unitId: 'U9', room: 'Kitchen',
      brand: 'Panasonic', model: 'NN-SN936W', serial: '6B88201145', purchaseDate: '2018-07-15', purchasePrice: 249,
      supplier: 'Amazon', installDate: '2018-07-20', warrantyEnd: '2019-07-15', condition: 'Failed',
      status: 'Retired', retiredDate: dOff(-120), disposalNotes: 'Magnetron failed. Removed during unit turnover; e-waste recycling.',
    },
  ];

  const requests: MaintenanceRequest[] = [
    {
      id: MR(12), title: 'Refrigerator Not Cooling', description: 'Tenant reports the refrigerator section is at 52°F and food is spoiling. Freezer still partially cold. Unit is running constantly and making a clicking noise every few minutes.',
      category: 'Appliance', subcategory: 'Poor Performance', priority: 'High', status: 'Assigned',
      propertyId: 'P1', unitId: 'U2', room: 'Kitchen', tenantId: 'T2', leaseId: 'L2', assetId: 'AST-101',
      reportedByName: 'David Chen', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-6, 8, 15),
      preferredDate: dOff(-4), targetDate: dOff(1), assignedStaffId: 'S2', assignedContractorId: 'C3', assignedAt: dtOff(-5, 10),
      internalNotes: 'Third cooling issue on this fridge in 18 months. If the sealed system is failing, get a replacement quote before authorizing major parts.',
      tenantNotes: 'Technician visit booked. Please move perishables to a cooler if possible — we can reimburse ice.',
      contractorNotes: 'Check start relay and condenser fan first — clicking suggests relay cycling.',
      accessInstructions: 'Tenant works from home; knock and wait. Dog (small, friendly) in unit.',
      preferredAccessTimes: 'Weekdays 9am–4pm', petsNote: 'Small dog — friendly, may bark.',
      approvalStatus: 'Approved', approvedBudget: 180, linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(11), title: 'Kitchen Sink Leaking Under Cabinet', description: 'Water pooling under the kitchen sink. Appears to come from the trap connection. Cabinet floor is damp but no visible damage yet. Tenant has placed a bucket underneath.',
      category: 'Plumbing', subcategory: 'Leak', priority: 'Normal', status: 'In Progress',
      propertyId: 'P1', unitId: 'U1', room: 'Kitchen', tenantId: 'T1', leaseId: 'L1',
      reportedByName: 'Sarah Mitchell', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-9, 19, 40),
      targetDate: dOff(2), assignedStaffId: 'S2', assignedContractorId: 'C1', assignedAt: dtOff(-8, 9),
      internalNotes: 'Check cabinet floor for swelling once dry. Photograph for deposit records.',
      accessInstructions: 'Lock box on railing, code 4417. Tenant at work during the day — entry permitted with notice.',
      preferredAccessTimes: 'Any time with 24h notice',
      approvalStatus: 'Not Required', linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(14), title: 'Furnace Not Working — No Heat', description: 'Tenant woke up to no heat. Thermostat set to 71°F, indoor temp 58°F and falling. Furnace attempts to start then shuts off after a few seconds. Two small children in the unit.',
      category: 'Heating, Ventilation & Air Conditioning', subcategory: 'No Heat', priority: 'Emergency', status: 'New',
      propertyId: 'P1', unitId: 'U3', room: 'Utility Closet', tenantId: 'T3', leaseId: 'L3', assetId: 'AST-104',
      reportedByName: 'Maria Garcia', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(0, 6, 20),
      targetDate: dOff(0), assignedStaffId: 'S2',
      internalNotes: 'EMERGENCY: no heat with children in unit. Furnace under Carrier parts warranty — dispatch CoolAir and request warranty processing. Offer space heaters from office stock meanwhile.',
      tenantNotes: 'We have received your report and marked it as an emergency. A technician is being dispatched today.',
      accessInstructions: 'Tenant home all day. Call on arrival.',
      approvalStatus: 'Not Required', linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(9), title: 'Dishwasher Not Draining — Error Code E24', description: 'Dishwasher stops mid-cycle with standing water in the bottom and shows error E24. Tenant has cleaned the filter. FixIt diagnosed a failed drain pump. Given the age of the unit (2017), repair-versus-replace decision is pending estimate approval.',
      category: 'Appliance', subcategory: 'Not Working', priority: 'High', status: 'Awaiting Approval',
      propertyId: 'P1', unitId: 'U4', room: 'Kitchen', tenantId: 'T4', leaseId: 'L4', assetId: 'AST-102',
      reportedByName: 'James Wilson', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-11, 12, 5),
      targetDate: dOff(4), assignedStaffId: 'S2', assignedContractorId: 'C3', assignedAt: dtOff(-10, 11),
      internalNotes: 'Repair quoted at $340 on an 8-year-old dishwasher that cost $649 new. Replacement units start ~$549 + install. Landlord decision needed — see Estimates tab.',
      tenantNotes: 'Your dishwasher needs a new drain pump. We are reviewing the repair estimate and will confirm the appointment shortly.',
      accessInstructions: 'Tenant prefers afternoon visits. Two cats — keep door closed.',
      petsNote: 'Two indoor cats.',
      approvalStatus: 'Pending Approval', linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(5), title: 'Bedroom Window Does Not Close', description: 'Primary bedroom window would not close fully — sash balance cord snapped, leaving a 2-inch gap at the bottom. Security and weather concern.',
      category: 'Doors and Windows', subcategory: 'Won’t Close / Latch', priority: 'Normal', status: 'Completed',
      propertyId: 'P1', unitId: 'U5', room: 'Bedroom', tenantId: 'T5', leaseId: 'L5',
      reportedByName: 'Emily Johnson', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-12, 10, 30),
      targetDate: dOff(-7), completedAt: dOff(-8), assignedStaffId: 'S2', assignedContractorId: 'C5', assignedAt: dtOff(-11, 9),
      approvalStatus: 'Not Required', resolutionOutcome: 'Repaired',
      resolutionNotes: 'Replaced both sash balance assemblies and re-seated the sash. Window now opens, closes, and latches correctly. Tested with tenant present.',
      verifiedBy: 'Jamie Lee', verificationStatus: 'Verified',
      linkedExpenseIds: ['EXP-2001'], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(8), title: 'Replace Worn-Out Washing Machine', description: 'Washer (2016 Samsung) shakes violently on spin and intermittently fails to drain. FixIt advises the spider arm and bearings are worn; repair would exceed $450 on a 9-year-old machine. Replacement approved — coordinate delivery, install new supply hoses, and haul away the old unit.',
      category: 'Appliance', subcategory: 'Poor Performance', priority: 'Normal', status: 'Approved',
      propertyId: 'P1', unitId: 'U2', room: 'Laundry Closet', tenantId: 'T2', leaseId: 'L2', assetId: 'AST-103',
      reportedByName: 'Sam Ortiz', reportedByRole: 'Maintenance Staff', source: 'Inspection', reportedAt: dtOff(-14, 14, 0),
      targetDate: dOff(9), assignedStaffId: 'S2',
      internalNotes: 'Replacement budget approved at $1,150 all-in. Use the Replace Appliance workflow once the new unit is purchased so asset history carries over correctly.',
      approvalStatus: 'Approved', approvedBudget: 1150, linkedExpenseIds: [], previousCompletions: [], createdBy: 'Alex Morgan',
    },
    {
      id: MR(13), title: 'Bathroom Exhaust Fan Very Noisy', description: 'Exhaust fan in the main bathroom rattles loudly and barely moves air. Mirror fogs and stays fogged. Possibly worn motor bearings or loose housing.',
      category: 'Electrical', subcategory: 'Other', priority: 'Low', status: 'Under Review',
      propertyId: 'P2', unitId: 'U7', room: 'Main Bathroom', tenantId: 'T6', leaseId: 'L6',
      reportedByName: 'Michael Brown', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-3, 21, 15),
      targetDate: dOff(11), assignedStaffId: 'S2',
      internalNotes: 'Combine with water heater visit (MR for Unit A) if scheduling allows — Sam can inspect while ProFlow is on site.',
      approvalStatus: 'Not Required', linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(10), title: 'Water Heater — No Hot Water', description: 'Pilot light will not stay lit. ProFlow diagnosed a failed thermocouple and a corroded pilot assembly. Parts ordered; repair on hold pending delivery. Note the tank warranty expires in ~2 months — if the tank itself shows corrosion, escalate to a warranty claim instead of repair.',
      category: 'Plumbing', subcategory: 'Water Heater', priority: 'High', status: 'On Hold',
      propertyId: 'P2', unitId: 'U7', room: 'Garage Utility', tenantId: 'T6', leaseId: 'L6', assetId: 'AST-105',
      reportedByName: 'Michael Brown', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-13, 7, 45),
      targetDate: dOff(-2), assignedStaffId: 'S2', assignedContractorId: 'C1', assignedAt: dtOff(-12, 13),
      internalNotes: 'ON HOLD: waiting on thermocouple/pilot assembly from Rheem (ETA given as 3–5 business days). Tenant given electric kettle + gym shower passes. Chase ProFlow daily.',
      tenantNotes: 'Parts for your water heater are on order. We will confirm the repair appointment as soon as they arrive and have credited your account for the inconvenience.',
      accessInstructions: 'Water heater is in the garage — side door key under mat is NOT permitted; tenant will meet contractor.',
      approvalStatus: 'Approved', approvedBudget: 260, linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(7), title: 'Garage Door Opener Works Intermittently', description: 'Opener responded only sometimes and reversed unexpectedly. HandyWorks found a failing logic board and misaligned safety sensors.',
      category: 'Electrical', subcategory: 'Other', priority: 'Normal', status: 'Completed',
      propertyId: 'P4', unitId: 'U13', room: 'Garage', tenantId: 'T9', leaseId: 'L9', assetId: 'AST-112',
      reportedByName: 'Lisa Anderson', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-15, 9, 10),
      targetDate: dOff(-6), completedAt: dOff(-4), assignedStaffId: 'S2', assignedContractorId: 'C5', assignedAt: dtOff(-14, 10),
      approvalStatus: 'Not Required', resolutionOutcome: 'Repaired',
      resolutionNotes: 'Replaced logic board, realigned and cleaned safety sensors, reprogrammed both remotes. Full open/close and auto-reverse test passed.',
      verifiedBy: 'Sam Ortiz', verificationStatus: 'Verified', warrantyInfo: 'Logic board: 1-year Chamberlain parts warranty.',
      linkedExpenseIds: ['EXP-2005'], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(6), title: 'Refrigerator Failed — Replacement Installed', description: 'Refrigerator stopped cooling entirely. FixIt confirmed compressor failure; repair estimate $780 on a 9-year-old unit. Landlord approved replacement. New Frigidaire installed, old unit hauled away, asset records updated (AST-109 → AST-110).',
      category: 'Appliance', subcategory: 'Not Working', priority: 'High', status: 'Closed',
      propertyId: 'P2', unitId: 'U8', room: 'Kitchen', tenantId: 'T7', leaseId: 'L7', assetId: 'AST-109',
      reportedByName: 'Anna Kowalski', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-38, 18, 20),
      targetDate: dOff(-33), completedAt: dOff(-30), assignedStaffId: 'S2', assignedContractorId: 'C3', assignedAt: dtOff(-37, 9),
      approvalStatus: 'Approved', approvedBudget: 1500, resolutionOutcome: 'Replaced',
      resolutionNotes: 'Replaced failed Samsung (AST-109) with Frigidaire Gallery (AST-110). Old appliance record retained with full history and marked Replaced. Tenant food loss reimbursed separately.',
      verifiedBy: 'Alex Morgan', verificationStatus: 'Verified', warrantyInfo: 'New unit: 1-year full + 2-year extended warranty (FRG-W-77120).',
      linkedExpenseIds: ['EXP-2002', 'EXP-2003'], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(15), title: 'Ants in Kitchen — Pest Treatment', description: 'Tenant reports a trail of ants along the kitchen counter and around the sink. No food left out. Similar issue last spring was resolved with perimeter treatment.',
      category: 'Pest Control', subcategory: 'Insects', priority: 'Normal', status: 'New',
      propertyId: 'P3', unitId: 'U10', room: 'Kitchen', tenantId: 'T8', leaseId: 'L8',
      reportedByName: 'Robert Taylor', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-1, 20, 5),
      targetDate: dOff(5),
      accessInstructions: 'Tenant requests 48h notice before any interior treatment (toddler in home).',
      approvalStatus: 'Not Required', linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(4), title: 'AC Not Cooling — Blowing Warm Air', description: 'Central AC ran continuously but only blew warm air; indoor temp reached 84°F. CoolAir found a failed run capacitor and refrigerant 1.5 lbs low.',
      category: 'Heating, Ventilation & Air Conditioning', subcategory: 'No Cooling', priority: 'High', status: 'Closed',
      propertyId: 'P3', unitId: 'U10', room: 'Whole Unit', tenantId: 'T8', leaseId: 'L8', assetId: 'AST-106',
      reportedByName: 'Robert Taylor', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-52, 15, 30),
      targetDate: dOff(-49), completedAt: dOff(-47), assignedStaffId: 'S2', assignedContractorId: 'C2', assignedAt: dtOff(-51, 8),
      approvalStatus: 'Approved', approvedBudget: 420, resolutionOutcome: 'Repaired',
      resolutionNotes: 'Replaced dual run capacitor, leak-checked (none found — Schrader core replaced), charged to spec. Supply air at 56°F on departure. Compressor covered under Trane warranty if it recurs.',
      verifiedBy: 'Alex Morgan', verificationStatus: 'Verified',
      linkedExpenseIds: ['EXP-2004'], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(16), title: 'Hallway Light Flickering (3rd Floor)', description: 'Ceiling light in the 3rd-floor common hallway flickers intermittently. Noticed during evening walk-through. Check tube/driver and the dimmer circuit.',
      category: 'Common Areas', subcategory: 'Hallway', priority: 'Low', status: 'Draft',
      propertyId: 'P1', room: '3rd Floor Hallway',
      reportedByName: 'Sam Ortiz', reportedByRole: 'Maintenance Staff', source: 'Maintenance Staff', reportedAt: dtOff(0, 9, 0),
      approvalStatus: 'Not Required', linkedExpenseIds: [], previousCompletions: [], createdBy: 'Sam Ortiz',
    },
    {
      id: MR(3), title: 'Painting Touch-Up After Leak Repair', description: 'Water stain on kitchen ceiling from the earlier upstairs leak needs stain-blocker and repainting.',
      category: 'Painting', subcategory: 'Touch-Up', priority: 'Low', status: 'Cancelled',
      propertyId: 'P1', unitId: 'U1', room: 'Kitchen', tenantId: 'T1', leaseId: 'L1',
      reportedByName: 'Sarah Mitchell', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-30, 11, 0),
      statusReason: 'Deferred to unit turnover at tenant’s request — paint during scheduled refresh to avoid a second disruption. Tenant confirmed in writing.',
      approvalStatus: 'Not Required', linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(17), title: 'Sump Pump Alarm Sounding', description: 'High-water alarm on the sump pump is sounding intermittently after heavy rain. Pump is running but cycling frequently. Needs inspection before the next storm — basement has finished areas.',
      category: 'Plumbing', subcategory: 'Other', priority: 'High', status: 'New',
      propertyId: 'P4', unitId: 'U13', room: 'Basement', tenantId: 'T9', leaseId: 'L9', assetId: 'AST-111',
      reportedByName: 'Lisa Anderson', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-2, 22, 40),
      targetDate: dOff(-1), assignedStaffId: 'S2',
      internalNotes: 'Was due yesterday — needs dispatch today. Ask Sam to test float switch and check discharge line for partial blockage.',
      approvalStatus: 'Not Required', linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(2), title: 'Smoke Alarm Chirping — Replaced Unit', description: 'Hallway smoke alarm chirping despite new battery; unit was past its 10-year life. Replaced with a sealed 10-year lithium alarm by in-house staff.',
      category: 'Safety and Security', subcategory: 'Smoke / CO Alarms', priority: 'Normal', status: 'Completed',
      propertyId: 'P2', unitId: 'U8', room: 'Hallway', tenantId: 'T7', leaseId: 'L7',
      reportedByName: 'Anna Kowalski', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(-21, 8, 0),
      targetDate: dOff(-19), completedAt: dOff(-20), assignedStaffId: 'S3',
      approvalStatus: 'Not Required', resolutionOutcome: 'Replaced',
      resolutionNotes: 'Installed First Alert sealed-battery alarm (10-year). Tested all alarms in unit; CO alarm OK. Next alarm inspection is on the preventive schedule.',
      verifiedBy: 'Jamie Lee', verificationStatus: 'Verified',
      linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(18), title: 'Front Door Lock Stiff — Hard to Turn', description: 'Deadbolt is very stiff and the key is difficult to turn, especially in the morning. Tenant is concerned about being locked out. Lubricate/realign strike or replace cylinder.',
      category: 'Doors and Windows', subcategory: 'Lock', priority: 'Normal', status: 'New',
      propertyId: 'P3', unitId: 'U12', room: 'Entry', tenantId: 'T10', leaseId: 'L10',
      reportedByName: 'Kevin Park', reportedByRole: 'Tenant', source: 'Tenant', reportedAt: dtOff(0, 7, 50),
      targetDate: dOff(7),
      accessInstructions: 'Tenant can meet after 5pm weekdays, or entry permitted with notice.',
      approvalStatus: 'Not Required', linkedExpenseIds: [], previousCompletions: [], createdBy: 'Jamie Lee',
    },
    {
      id: MR(1), title: 'Roof Leak Above Bathroom', description: 'Water stain and active drip in the Unit 6 bathroom ceiling during heavy rain. Apex found cracked flashing around the vent stack.',
      category: 'Roofing', subcategory: 'Flashing', priority: 'High', status: 'Closed',
      propertyId: 'P1', unitId: 'U6', room: 'Bathroom',
      reportedByName: 'Alex Morgan', reportedByRole: 'Property Manager', source: 'Inspection', reportedAt: dtOff(-70, 10, 0),
      targetDate: dOff(-63), completedAt: dOff(-64), assignedStaffId: 'S1', assignedContractorId: 'C7',
      approvalStatus: 'Approved', approvedBudget: 700, resolutionOutcome: 'Repaired',
      resolutionNotes: 'Replaced vent stack flashing and two damaged shingles. Interior ceiling repaired and repainted during turnover. No recurrence through two subsequent storms.',
      verifiedBy: 'Alex Morgan', verificationStatus: 'Verified',
      linkedExpenseIds: ['EXP-2006'], previousCompletions: [], createdBy: 'Alex Morgan',
    },
  ];

  const estimates: Estimate[] = [
    {
      id: 'EST-501', requestId: MR(12), contractorId: 'C3', label: 'FixIt repair estimate — start relay & condenser fan motor',
      labor: 110, materials: 55, other: 0, tax: 15, total: 180, status: 'Approved',
      submittedBy: 'Hassan Ali (FixIt Appliance Repair)', submittedAt: dtOff(-4, 13, 30),
      approvedBy: 'Alex Morgan', approvedAt: dtOff(-4, 16, 5), approvedBudget: 180,
      notes: 'Diagnosis fee of $65 waived if repair proceeds. If compressor is also weak, technician will stop and re-quote before further work.',
    },
    {
      id: 'EST-502', requestId: MR(11), contractorId: 'C1', label: 'ProFlow verbal estimate — P-trap & supply lines',
      labor: 85, materials: 35, other: 0, tax: 0, total: 120, status: 'Not Required',
      submittedBy: 'Mike Delgado (ProFlow Plumbing)', submittedAt: dtOff(-7, 10, 0),
      notes: 'Below approval threshold — proceeded under standing authorization.',
    },
    {
      id: 'EST-503', requestId: MR(9), contractorId: 'C3', label: 'FixIt quote #9102 — drain pump replacement',
      labor: 160, materials: 145, other: 15, tax: 20, total: 340, status: 'Pending Approval',
      submittedBy: 'Hassan Ali (FixIt Appliance Repair)', submittedAt: dtOff(-8, 15, 45),
      notes: 'OEM Bosch pump. Technician notes racks and door seal also worn; machine is 8 years old. Comparable new Bosch ≈ $649 + $129 install.',
    },
    {
      id: 'EST-504', requestId: MR(8), contractorId: 'C5', label: 'Replacement budget — top-load washer, delivered & installed',
      labor: 120, materials: 899, other: 124, tax: 7, total: 1150, status: 'Approved',
      submittedBy: 'Jamie Lee', submittedAt: dtOff(-12, 9, 30),
      approvedBy: 'Alex Morgan', approvedAt: dtOff(-11, 11, 20), approvedBudget: 1150,
      notes: 'Materials = appliance $899. Other = delivery $79 + haul-away $45. Includes new braided supply hoses.',
    },
    {
      id: 'EST-505', requestId: MR(10), contractorId: 'C1', label: 'ProFlow estimate — thermocouple & pilot assembly',
      labor: 150, materials: 92, other: 0, tax: 18, total: 260, status: 'Approved',
      submittedBy: 'Mike Delgado (ProFlow Plumbing)', submittedAt: dtOff(-12, 16, 10),
      approvedBy: 'Alex Morgan', approvedAt: dtOff(-12, 17, 0), approvedBudget: 260,
      notes: 'Parts on order from Rheem. If tank corrosion is found, stop work and convert to warranty claim (tank warranty expires soon).',
    },
    {
      id: 'EST-506', requestId: MR(4), contractorId: 'C2', label: 'CoolAir estimate — capacitor & refrigerant charge',
      labor: 210, materials: 140, other: 25, tax: 45, total: 420, status: 'Approved',
      submittedBy: 'Tina Brooks (CoolAir HVAC Services)', submittedAt: dtOff(-50, 11, 0),
      approvedBy: 'Alex Morgan', approvedAt: dtOff(-50, 12, 30), approvedBudget: 420,
    },
  ];

  const visits: Visit[] = [
    { id: 'V1', requestId: MR(12), workOrderId: 'WO-1001', contractorId: 'C3', purpose: 'Diagnosis visit', date: dOff(-4), time: '10:00', durationMins: 45, status: 'Completed', notes: 'Confirmed failed start relay; condenser fan motor drawing high amps. Estimate submitted same day.', accessArrangements: 'Tenant home (WFH).' },
    { id: 'V2', requestId: MR(12), workOrderId: 'WO-1001', contractorId: 'C3', purpose: 'Repair visit — replace relay & fan motor', date: dOff(1), time: '09:30', durationMins: 90, status: 'Scheduled', accessArrangements: 'Tenant home; dog in unit.' },
    { id: 'V3', requestId: MR(11), workOrderId: 'WO-1002', contractorId: 'C1', purpose: 'Leak inspection & shut-off replacement', date: dOff(-7), time: '13:00', durationMins: 60, status: 'Completed', notes: 'Replaced angle stop. Trap reseal still needed.' },
    { id: 'V4', requestId: MR(11), workOrderId: 'WO-1002', contractorId: 'C1', purpose: 'Return visit — replace P-trap, test', date: dOff(2), time: '11:00', durationMins: 60, status: 'Scheduled', accessArrangements: 'Lock box 4417.' },
    { id: 'V5', requestId: MR(9), workOrderId: 'WO-1003', contractorId: 'C3', purpose: 'Diagnosis visit', date: dOff(-8), time: '14:00', durationMins: 40, status: 'Completed', notes: 'Drain pump impeller seized. Quote #9102 issued.' },
    { id: 'V6', requestId: MR(10), workOrderId: 'WO-1005', contractorId: 'C1', purpose: 'Diagnosis — pilot/thermocouple', date: dOff(-12), time: '15:00', durationMins: 50, status: 'Completed', notes: 'Parts ordered. Return visit once parts arrive.' },
    { id: 'V7', requestId: MR(5), workOrderId: 'WO-1006', contractorId: 'C5', purpose: 'Window sash repair', date: dOff(-8), time: '10:00', durationMins: 75, status: 'Completed' },
    { id: 'V8', requestId: MR(4), workOrderId: 'WO-1007', contractorId: 'C2', purpose: 'AC diagnosis & repair', date: dOff(-47), time: '09:00', durationMins: 120, status: 'Completed' },
    { id: 'V9', requestId: MR(7), workOrderId: 'WO-1009', contractorId: 'C5', purpose: 'Opener board replacement', date: dOff(-4), time: '13:30', durationMins: 60, status: 'Completed' },
  ];

  const workLogs: WorkLogEntry[] = [
    { id: 'WL1', requestId: MR(12), workOrderId: 'WO-1001', date: dtOff(-4, 10, 45), person: 'Hassan Ali (FixIt Appliance Repair)', workPerformed: 'Diagnostics: compressor start relay failed (scorched contacts); condenser fan motor drawing 2.1A vs 1.3A spec and running hot. Evaporator coils clean, no frost pattern issues.', diagnosis: 'Failed start relay causing compressor short-cycling; weakened condenser fan reducing heat rejection.', materials: 'None — diagnosis only', hours: 0.75, outcome: 'Diagnosis Only — Estimate To Follow', followUpRequired: true, notes: 'Estimate EST-501 submitted. Fridge left unplugged to protect compressor.' },
    { id: 'WL2', requestId: MR(11), workOrderId: 'WO-1002', date: dtOff(-7, 13, 50), person: 'Mike Delgado (ProFlow Plumbing)', workPerformed: 'Replaced corroded hot-side angle stop and supply line. Found P-trap slip nut cracked — trap assembly needs replacement (part not on truck). Leak reduced to slow drip into tenant’s bucket.', diagnosis: 'Cracked trap slip nut + corroded shut-off valve.', materials: '1× angle stop valve, 1× braided supply line', hours: 1, outcome: 'Partially Completed', followUpRequired: true, notes: 'Return visit booked to replace P-trap and pressure-test.' },
    { id: 'WL3', requestId: MR(9), workOrderId: 'WO-1003', date: dtOff(-8, 14, 40), person: 'Hassan Ali (FixIt Appliance Repair)', workPerformed: 'Ran diagnostic cycle; error E24 at drain stage. Removed and bench-tested drain pump — impeller seized, windings open. Checked drain hose and air gap: clear. Noted worn upper rack rollers and perished door seal (cosmetic).', diagnosis: 'Failed drain pump (OEM part 00631200).', materials: 'None — diagnosis only', hours: 0.7, outcome: 'Diagnosis Only — Estimate To Follow', followUpRequired: true, notes: 'Quote #9102 issued for $340. Advised landlord of appliance age for repair-vs-replace decision.' },
    { id: 'WL4', requestId: MR(10), workOrderId: 'WO-1005', date: dtOff(-12, 15, 50), person: 'Mike Delgado (ProFlow Plumbing)', workPerformed: 'Thermocouple output 8mV (spec 25–35mV) — pilot drops out. Pilot orifice partially blocked and assembly corroded. Tank exterior inspected: minor surface rust at base, no leaks. Parts ordered.', diagnosis: 'Failed thermocouple and corroded pilot assembly.', materials: 'On order: thermocouple + pilot assembly (Rheem SP20303A)', hours: 0.8, outcome: 'Parts Ordered — Return Visit Needed', followUpRequired: true, notes: 'Gas left safely off at appliance valve. Return visit to be scheduled on parts arrival.' },
    { id: 'WL5', requestId: MR(5), workOrderId: 'WO-1006', date: dtOff(-8, 11, 15), person: 'Carlos Mendez (HandyWorks)', workPerformed: 'Replaced both coil sash balances, cleaned tracks, re-seated sash and adjusted latch keepers. Window cycles smoothly and seals fully.', materials: '2× coil balance assemblies', hours: 1.25, outcome: 'Work Completed', followUpRequired: false },
    { id: 'WL6', requestId: MR(4), workOrderId: 'WO-1007', date: dtOff(-47, 11, 0), person: 'Tina Brooks (CoolAir HVAC)', workPerformed: 'Replaced failed dual run capacitor (45/5 µF). Leak check: replaced leaking Schrader cores. Charged 1.5 lbs R-410A to manufacturer subcooling spec. Verified 19°F delta-T.', diagnosis: 'Failed capacitor; low charge from leaking service port cores.', materials: 'Dual run capacitor, 2× Schrader cores, 1.5 lbs R-410A', hours: 2, outcome: 'Work Completed', followUpRequired: false, notes: 'Recommend coil cleaning at next preventive service.' },
    { id: 'WL7', requestId: MR(6), date: dtOff(-37, 10, 30), person: 'Hassan Ali (FixIt Appliance Repair)', workPerformed: 'Compressor windings shorted to ground — sealed system failure. Provided replacement recommendation in writing.', diagnosis: 'Compressor failure (electrical short). Beyond economical repair.', hours: 0.5, outcome: 'Replacement Recommended', followUpRequired: true },
    { id: 'WL8', requestId: MR(7), workOrderId: 'WO-1009', date: dtOff(-4, 14, 30), person: 'Carlos Mendez (HandyWorks)', workPerformed: 'Replaced logic board, realigned photo-eye sensors, adjusted travel limits, reprogrammed remotes and keypad.', diagnosis: 'Logic board relay failure + sensor misalignment.', materials: 'Chamberlain logic board 041A7956', hours: 1, outcome: 'Work Completed', followUpRequired: false },
  ];

  const workOrders: WorkOrder[] = [
    { id: 'WO-1001', requestId: MR(12), title: 'Diagnose & repair refrigerator cooling fault', description: 'Fridge section warm; clicking noise. Diagnose sealed system vs. start components.', scope: 'Replace compressor start relay and condenser fan motor per estimate EST-501. Verify temps after 2-hour run.', contractorId: 'C3', staffId: 'S2', priority: 'High', scheduledDate: dOff(1), targetDate: dOff(1), status: 'Scheduled', estimate: 180, approvedBudget: 180, createdAt: dtOff(-5, 10) },
    { id: 'WO-1002', requestId: MR(11), title: 'Repair kitchen sink leak', description: 'Leak at trap/supply under kitchen sink.', scope: 'Replace angle stops as needed, replace P-trap assembly, test under pressure, dry cabinet and report any water damage.', contractorId: 'C1', staffId: 'S2', priority: 'Normal', scheduledDate: dOff(2), targetDate: dOff(2), status: 'In Progress', estimate: 120, createdAt: dtOff(-8, 9) },
    { id: 'WO-1003', requestId: MR(9), title: 'Dishwasher drain pump replacement', description: 'Replace failed drain pump (pending estimate approval).', scope: 'Supply & fit OEM Bosch drain pump; run full test cycle. DO NOT START until estimate approved.', contractorId: 'C3', priority: 'High', targetDate: dOff(4), status: 'Draft', estimate: 340, createdAt: dtOff(-8, 16) },
    { id: 'WO-1004', requestId: MR(8), title: 'Supply, deliver & install replacement washer', description: 'Replace 2016 Samsung washer with approved new unit.', scope: 'Deliver new washer, install with new braided hoses, level and test, haul away old unit for recycling. Record new asset serial number on completion.', priority: 'Normal', targetDate: dOff(9), status: 'Awaiting Assignment', estimate: 1150, approvedBudget: 1150, createdAt: dtOff(-11, 11, 30) },
    { id: 'WO-1005', requestId: MR(10), title: 'Water heater thermocouple & pilot assembly', description: 'No hot water — pilot will not stay lit.', scope: 'Replace thermocouple and pilot assembly on parts arrival. Inspect tank base; if corroded through, stop and escalate to warranty claim.', contractorId: 'C1', staffId: 'S2', priority: 'High', targetDate: dOff(-2), status: 'On Hold', estimate: 260, approvedBudget: 260, createdAt: dtOff(-12, 13) },
    { id: 'WO-1006', requestId: MR(5), title: 'Window sash balance repair', description: 'Bedroom window will not close.', contractorId: 'C5', priority: 'Normal', scheduledDate: dOff(-8), targetDate: dOff(-7), status: 'Completed', estimate: 95, actualCost: 95, completionNotes: 'Both balances replaced; window verified with tenant.', linkedExpenseId: 'EXP-2001', createdAt: dtOff(-11, 9) },
    { id: 'WO-1007', requestId: MR(4), title: 'AC capacitor & refrigerant service', description: 'AC blowing warm air.', contractorId: 'C2', priority: 'High', scheduledDate: dOff(-47), targetDate: dOff(-49), status: 'Completed', estimate: 420, approvedBudget: 420, actualCost: 385, completionNotes: 'Capacitor replaced, charged to spec, 19°F delta-T verified.', linkedExpenseId: 'EXP-2004', createdAt: dtOff(-51, 8) },
    { id: 'WO-1008', requestId: MR(6), title: 'Remove old refrigerator, install replacement', description: 'Haul away failed unit; install new Frigidaire.', contractorId: 'C5', priority: 'High', scheduledDate: dOff(-30), targetDate: dOff(-33), status: 'Completed', estimate: 150, actualCost: 150, completionNotes: 'New unit leveled, water line connected, old unit removed for refrigerant recovery.', linkedExpenseId: 'EXP-2003', createdAt: dtOff(-34, 9) },
    { id: 'WO-1009', requestId: MR(7), title: 'Garage opener logic board replacement', description: 'Opener intermittent; reverses unexpectedly.', contractorId: 'C5', priority: 'Normal', scheduledDate: dOff(-4), targetDate: dOff(-6), status: 'Completed', estimate: 175, actualCost: 160, completionNotes: 'Board replaced; sensors aligned; remotes reprogrammed.', linkedExpenseId: 'EXP-2005', createdAt: dtOff(-14, 10) },
  ];

  const expenses: Expense[] = [
    { id: 'EXP-2001', description: 'HandyWorks invoice #4471 — window sash repair, Maple Court Unit 5', vendor: 'HandyWorks General Contracting', contractorId: 'C5', propertyId: 'P1', unitId: 'U5', category: 'Maintenance & Repairs', amount: 95, date: dOff(-8), paymentStatus: 'Paid', invoiceRef: 'HW-4471', linkedRequestId: MR(5), linkedWorkOrderId: 'WO-1006' },
    { id: 'EXP-2002', description: 'Frigidaire Gallery refrigerator — ApplianceWorld order #55210', vendor: 'ApplianceWorld', propertyId: 'P2', unitId: 'U8', category: 'Appliance Purchase', amount: 1299, date: dOff(-31), paymentStatus: 'Paid', invoiceRef: 'AW-55210', linkedRequestId: MR(6), linkedAssetId: 'AST-110' },
    { id: 'EXP-2003', description: 'Refrigerator delivery, installation & haul-away', vendor: 'HandyWorks General Contracting', contractorId: 'C5', propertyId: 'P2', unitId: 'U8', category: 'Maintenance & Repairs', amount: 150, date: dOff(-30), paymentStatus: 'Paid', invoiceRef: 'HW-4402', linkedRequestId: MR(6), linkedWorkOrderId: 'WO-1008' },
    { id: 'EXP-2004', description: 'CoolAir invoice #8819 — AC capacitor & refrigerant, Oakwood TH-2', vendor: 'CoolAir HVAC Services', contractorId: 'C2', propertyId: 'P3', unitId: 'U10', category: 'Maintenance & Repairs', amount: 385, date: dOff(-47), paymentStatus: 'Paid', invoiceRef: 'CA-8819', linkedRequestId: MR(4), linkedWorkOrderId: 'WO-1007' },
    { id: 'EXP-2005', description: 'HandyWorks invoice #4490 — garage opener board, Hillcrest', vendor: 'HandyWorks General Contracting', contractorId: 'C5', propertyId: 'P4', unitId: 'U13', category: 'Maintenance & Repairs', amount: 160, date: dOff(-4), dueDate: dOff(10), paymentStatus: 'Unpaid', invoiceRef: 'HW-4490', linkedRequestId: MR(7), linkedWorkOrderId: 'WO-1009' },
    { id: 'EXP-2006', description: 'Apex Roofing — vent stack flashing & shingle repair, Maple Court', vendor: 'Apex Roofing Co.', contractorId: 'C7', propertyId: 'P1', unitId: 'U6', category: 'Maintenance & Repairs', amount: 640, date: dOff(-64), paymentStatus: 'Paid', invoiceRef: 'APX-2210', linkedRequestId: MR(1) },
    { id: 'EXP-2007', description: 'City of Austin water & wastewater — Maple Court (monthly)', vendor: 'City of Austin Utilities', propertyId: 'P1', category: 'Utilities', amount: 212.4, date: dOff(-3), dueDate: dOff(11), paymentStatus: 'Unpaid', invoiceRef: 'COA-88412077' },
    { id: 'EXP-2008', description: 'Landlord insurance — quarterly premium, all properties', vendor: 'Steadily Insurance', category: 'Insurance', amount: 1480, date: dOff(-18), paymentStatus: 'Paid', invoiceRef: 'STD-Q-2291' },
    { id: 'EXP-2009', description: 'GreenScape monthly grounds service — Oakwood Townhomes', vendor: 'GreenScape Lawn Care', propertyId: 'P3', category: 'Landscaping', amount: 320, date: dOff(-2), dueDate: dOff(12), paymentStatus: 'Unpaid', invoiceRef: 'GS-1147' },
    { id: 'EXP-2010', description: 'ProFlow invoice #6631 — sink leak visit 1 of 2 (shut-off valve), Maple Court Unit 1', vendor: 'ProFlow Plumbing', contractorId: 'C1', propertyId: 'P1', unitId: 'U1', category: 'Maintenance & Repairs', amount: 75, date: dOff(-7), dueDate: dOff(7), paymentStatus: 'Partially Paid', amountPaid: 40, invoiceRef: 'PF-6631' },
    { id: 'EXP-2011', description: 'FixIt diagnosis visit — refrigerator, Maple Court Unit 2', vendor: 'FixIt Appliance Repair', contractorId: 'C3', propertyId: 'P1', unitId: 'U2', category: 'Maintenance & Repairs', amount: 65, date: dOff(-4), dueDate: dOff(10), paymentStatus: 'Unpaid', invoiceRef: 'FX-8841' },
    { id: 'EXP-2012', description: 'Austin Energy electric — Riverside common meter', vendor: 'Austin Energy', propertyId: 'P2', category: 'Utilities', amount: 148.22, date: dOff(-16), dueDate: dOff(-2), paymentStatus: 'Overdue', invoiceRef: 'AE-00981237' },
    { id: 'EXP-2013', description: 'FixIt — refrigerator evaporator fan motor, Maple Court Unit 2 (AST-101)', vendor: 'FixIt Appliance Repair', contractorId: 'C3', propertyId: 'P1', unitId: 'U2', category: 'Maintenance & Repairs', amount: 210, date: dOff(-200), paymentStatus: 'Paid', invoiceRef: 'FX-7102', linkedAssetId: 'AST-101' },
    { id: 'EXP-2014', description: 'FixIt — refrigerator defrost heater & thermostat, Maple Court Unit 2 (AST-101)', vendor: 'FixIt Appliance Repair', contractorId: 'C3', propertyId: 'P1', unitId: 'U2', category: 'Maintenance & Repairs', amount: 145, date: dOff(-430), paymentStatus: 'Paid', invoiceRef: 'FX-5980', linkedAssetId: 'AST-101' },
    { id: 'EXP-2015', description: 'SafeHome quarterly perimeter treatment — Maple Court', vendor: 'SafeHome Pest Control', contractorId: 'C6', propertyId: 'P1', category: 'Maintenance & Repairs', amount: 129, date: dOff(-25), paymentStatus: 'Paid', invoiceRef: 'SH-3320' },
  ];

  const schedules: PreventiveSchedule[] = [
    { id: 'PM-301', task: 'Annual Furnace Service & Safety Check', category: 'Heating, Ventilation & Air Conditioning', propertyId: 'P1', unitId: 'U3', assetId: 'AST-104', frequency: 'Annual', lastCompleted: dOff(-353), nextDue: dOff(12), contractorId: 'C2', estimatedCost: 189, checklist: ['Inspect heat exchanger for cracks', 'Clean burners & flame sensor', 'Test CO levels at registers', 'Replace filter (16×25×1)', 'Verify thermostat calibration'], instructions: 'Carrier warranty requires documented annual service. Keep the service report on file.', active: true },
    { id: 'PM-302', task: 'Smoke & CO Alarm Inspection', category: 'Safety and Security', propertyId: 'P2', frequency: 'Semi-Annual', lastCompleted: dOff(-185), nextDue: dOff(-3), estimatedCost: 45, checklist: ['Test every smoke alarm', 'Test CO alarms', 'Check manufacture dates (10-year life)', 'Replace batteries where applicable', 'Tenant sign-off sheet'], instructions: 'Both units. Coordinate entry with 48h notice.', active: true },
    { id: 'PM-303', task: 'HVAC Filter Replacement — All Units', category: 'Heating, Ventilation & Air Conditioning', propertyId: 'P1', frequency: 'Quarterly', lastCompleted: dOff(-86), nextDue: dOff(5), estimatedCost: 60, checklist: ['Replace filter in each unit', 'Note filter size discrepancies', 'Quick visual check of air handlers'], instructions: 'Filters in office stock. Sam handles Units 1–3, contractor not required.', active: true },
    { id: 'PM-304', task: 'Dryer Vent Cleaning', category: 'Appliance', propertyId: 'P1', unitId: 'U2', assetId: 'AST-108', frequency: 'Annual', lastCompleted: dOff(-380), nextDue: dOff(-15), estimatedCost: 110, checklist: ['Disconnect and brush vent run', 'Clean exterior hood', 'Check for crushed flex duct', 'Test airflow'], instructions: 'Fire-safety item — do not defer again.', active: true },
    { id: 'PM-305', task: 'Sump Pump Inspection & Battery Test', category: 'Plumbing', propertyId: 'P4', unitId: 'U13', assetId: 'AST-111', frequency: 'Semi-Annual', lastCompleted: dOff(-162), nextDue: dOff(20), estimatedCost: 85, checklist: ['Test float switch cycle', 'Load-test backup battery', 'Clear pit debris', 'Verify check valve'], active: true },
    { id: 'PM-306', task: 'Water Heater Flush & Anode Rod Check', category: 'Plumbing', propertyId: 'P2', unitId: 'U7', assetId: 'AST-105', frequency: 'Annual', lastCompleted: dOff(-325), nextDue: dOff(40), contractorId: 'C1', estimatedCost: 145, checklist: ['Drain & flush sediment', 'Inspect anode rod', 'Test T&P relief valve', 'Check venting draft'], instructions: 'Combine with the open thermocouple repair visit if still outstanding.', active: true },
    { id: 'PM-307', task: 'Gutter Cleaning & Downspout Check', category: 'Roofing', propertyId: 'P3', frequency: 'Semi-Annual', lastCompleted: dOff(-20), nextDue: dOff(162), contractorId: 'C5', estimatedCost: 275, checklist: ['Clear all gutters', 'Flush downspouts', 'Note fascia damage'], active: true },
    { id: 'PM-308', task: 'Seasonal Exterior Property Inspection', category: 'General Repairs', propertyId: 'P4', frequency: 'Annual', lastCompleted: dOff(-310), nextDue: dOff(55), estimatedCost: 0, checklist: ['Siding & trim condition', 'Deck boards & railings', 'Grading away from foundation'], instructions: 'Paused while roof project is scoped — reactivate next quarter.', active: false },
  ];

  const attachments: Attachment[] = [
    { id: 'AT1', requestId: MR(12), name: 'fridge-interior-temp.jpg', category: 'Initial Issue Photo', size: '2.4 MB', uploadedBy: 'David Chen (Tenant)', uploadedAt: dtOff(-6, 8, 16) },
    { id: 'AT2', requestId: MR(12), name: 'fixit-estimate-8841.pdf', category: 'Contractor Estimate', size: '184 KB', uploadedBy: 'Jamie Lee', uploadedAt: dtOff(-4, 13, 35) },
    { id: 'AT3', requestId: MR(11), name: 'under-sink-leak.jpg', category: 'Initial Issue Photo', size: '1.8 MB', uploadedBy: 'Sarah Mitchell (Tenant)', uploadedAt: dtOff(-9, 19, 41) },
    { id: 'AT4', requestId: MR(9), name: 'dishwasher-error-e24.jpg', category: 'Initial Issue Photo', size: '1.2 MB', uploadedBy: 'James Wilson (Tenant)', uploadedAt: dtOff(-11, 12, 6) },
    { id: 'AT5', requestId: MR(9), name: 'fixit-quote-9102-drain-pump.pdf', category: 'Contractor Estimate', size: '212 KB', uploadedBy: 'Hassan Ali (FixIt)', uploadedAt: dtOff(-8, 15, 50) },
    { id: 'AT6', requestId: MR(6), name: 'applianceworld-invoice-55210.pdf', category: 'Invoice', size: '156 KB', uploadedBy: 'Alex Morgan', uploadedAt: dtOff(-31, 14, 0) },
    { id: 'AT7', requestId: MR(6), name: 'new-fridge-installed.jpg', category: 'Before / After Photo', size: '3.1 MB', uploadedBy: 'Carlos Mendez (HandyWorks)', uploadedAt: dtOff(-30, 12, 20) },
    { id: 'AT8', assetId: 'AST-110', name: 'frigidaire-warranty-card-FRG-W-77120.pdf', category: 'Warranty Document', size: '98 KB', uploadedBy: 'Alex Morgan', uploadedAt: dtOff(-30, 16, 0) },
    { id: 'AT9', requestId: MR(10), name: 'water-heater-pilot-assembly.jpg', category: 'Initial Issue Photo', size: '2.0 MB', uploadedBy: 'Mike Delgado (ProFlow)', uploadedAt: dtOff(-12, 15, 55) },
    { id: 'AT10', requestId: MR(8), name: 'washer-condition-inspection.pdf', category: 'Inspection Report', size: '340 KB', uploadedBy: 'Sam Ortiz', uploadedAt: dtOff(-13, 10, 0) },
  ];

  const activity: ActivityEvent[] = [
    { id: 'AC1', requestId: MR(12), type: 'status', description: 'Status changed from New to Under Review', user: 'Jamie Lee', timestamp: dtOff(-6, 9, 5) },
    { id: 'AC2', requestId: MR(12), type: 'assignment', description: 'Assigned to FixIt Appliance Repair (coordinator: Jamie Lee)', user: 'Jamie Lee', timestamp: dtOff(-5, 10, 0) },
    { id: 'AC3', requestId: MR(12), type: 'visit', description: 'Diagnosis visit scheduled with FixIt Appliance Repair', user: 'Jamie Lee', timestamp: dtOff(-5, 10, 5) },
    { id: 'AC4', requestId: MR(12), type: 'worklog', description: 'Work log added: diagnosis — failed start relay, weak condenser fan', user: 'Jamie Lee', timestamp: dtOff(-4, 11, 0) },
    { id: 'AC5', requestId: MR(12), type: 'estimate', description: 'Estimate EST-501 submitted by FixIt Appliance Repair ($180)', user: 'Hassan Ali', timestamp: dtOff(-4, 13, 30) },
    { id: 'AC6', requestId: MR(12), type: 'approval', description: 'Estimate EST-501 approved — budget $180', user: 'Alex Morgan', timestamp: dtOff(-4, 16, 5) },
    { id: 'AC7', requestId: MR(12), type: 'visit', description: 'Repair visit scheduled (parts in hand)', user: 'Jamie Lee', timestamp: dtOff(-3, 9, 15) },
    { id: 'AC8', requestId: MR(9), type: 'assignment', description: 'Assigned to FixIt Appliance Repair for diagnosis', user: 'Jamie Lee', timestamp: dtOff(-10, 11, 0) },
    { id: 'AC9', requestId: MR(9), type: 'estimate', description: 'Estimate EST-503 submitted ($340) — pending approval', user: 'Hassan Ali', timestamp: dtOff(-8, 15, 45) },
    { id: 'AC10', requestId: MR(9), type: 'status', description: 'Status changed to Awaiting Approval', user: 'Jamie Lee', timestamp: dtOff(-8, 16, 0) },
    { id: 'AC11', requestId: MR(8), type: 'estimate', description: 'Replacement budget EST-504 submitted ($1,150)', user: 'Jamie Lee', timestamp: dtOff(-12, 9, 30) },
    { id: 'AC12', requestId: MR(8), type: 'approval', description: 'Replacement approved — budget $1,150', user: 'Alex Morgan', timestamp: dtOff(-11, 11, 20) },
    { id: 'AC13', requestId: MR(6), type: 'worklog', description: 'Diagnosis: compressor shorted to ground — replacement recommended', user: 'Hassan Ali', timestamp: dtOff(-37, 10, 30) },
    { id: 'AC14', requestId: MR(6), type: 'replacement', description: 'Asset AST-109 replaced by AST-110 (Frigidaire Gallery). Old asset retained as Replaced.', user: 'Alex Morgan', timestamp: dtOff(-30, 12, 30) },
    { id: 'AC15', requestId: MR(6), type: 'expense', description: 'Linked expenses EXP-2002 ($1,299) and EXP-2003 ($150)', user: 'Alex Morgan', timestamp: dtOff(-30, 16, 10) },
    { id: 'AC16', requestId: MR(6), type: 'completion', description: 'Request completed — outcome: Replaced. Final cost $1,449', user: 'Alex Morgan', timestamp: dtOff(-30, 16, 15) },
    { id: 'AC17', requestId: MR(10), type: 'status', description: 'Status changed to On Hold — waiting on Rheem parts', user: 'Jamie Lee', timestamp: dtOff(-11, 9, 0) },
    { id: 'AC18', requestId: MR(3), type: 'status', description: 'Request cancelled — deferred to unit turnover at tenant’s request', user: 'Jamie Lee', timestamp: dtOff(-28, 10, 0) },
  ];

  // Creation event for every request
  requests.forEach((r, i) => {
    activity.push({
      id: 'AC-C' + i, requestId: r.id, type: 'creation',
      description: `Request created via ${r.source.toLowerCase()} report`,
      user: r.createdBy, timestamp: r.reportedAt,
    });
  });

  const projects: Project[] = [
    { id: 'PRJ-1', name: 'Unit 5 Kitchen Refresh', propertyId: 'P1', unitId: 'U5', status: 'In Progress', budget: 8500, spent: 3240, progress: 38, start: dOff(-20), end: dOff(25) },
    { id: 'PRJ-2', name: 'Oakwood Roof Replacement', propertyId: 'P3', status: 'Planning', budget: 24000, spent: 450, progress: 5, start: dOff(30), end: dOff(75) },
    { id: 'PRJ-3', name: 'Riverside B Bathroom Renovation', propertyId: 'P2', unitId: 'U8', status: 'Completed', budget: 6200, spent: 5940, progress: 100, start: dOff(-120), end: dOff(-85) },
  ];

  return {
    properties, units, tenants, leases, staff, contractors, requests, estimates,
    visits, workLogs, workOrders, assets, expenses, schedules, attachments,
    activity, projects,
    settings: { emergencyResponseHours: 4, highResponseHours: 24, approvalThreshold: 250 },
  };
}
