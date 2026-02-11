// Seed data for Chicken Mutton Management System

export const users = [
  {
    id: 1,
    email: 'admin@supplier.com',
    password: 'admin123',
    name: 'Admin User'
  }
];

export const products = [
  {
    id: 'chicken',
    name: 'CHICKEN',
    image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?q=80&w=800',
    description: 'Poultry Management'
  },
  {
    id: 'mutton',
    name: 'MUTTON',
    image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?q=80&w=800',
    description: 'Sheep & Goat Management'
  }
];

export const suppliers = [
  {
    id: 1,
    name: 'JOSEPH',
    productType: 'chicken',
    active: true,
    subParties: [
      { id: 101, name: 'RMS', todayWeight: 0, totalWeight: 0 },
      { id: 102, name: 'Thamim', todayWeight: 0, totalWeight: 0 },
      { id: 103, name: 'Anna City', todayWeight: 0, totalWeight: 0 }
    ]
  },
  {
    id: 2,
    name: 'SADIQ',
    productType: 'chicken',
    active: true,
    subParties: [
      { id: 201, name: 'Party A', todayWeight: 0, totalWeight: 0 },
      { id: 202, name: 'Party B', todayWeight: 0, totalWeight: 0 }
    ]
  },
  {
    id: 3,
    name: 'OTHER CALCULATION',
    productType: 'chicken',
    active: true,
    subParties: [
      { id: 301, name: 'Iruppu', todayWeight: 0, totalWeight: 0 },
      { id: 302, name: 'Misc Items', todayWeight: 0, totalWeight: 0 }
    ]
  },
  {
    id: 4,
    name: 'RAHEEM',
    productType: 'mutton',
    active: true,
    subParties: [
      { id: 401, name: 'Farm A', todayWeight: 0, totalWeight: 0 },
      { id: 402, name: 'Farm B', todayWeight: 0, totalWeight: 0 }
    ]
  }
];

export const entries = [];

// Dashboard seed data matching the screenshot exactly
export const dashboardData = {
  suppliers: [
    {
      id: 'joseph',
      name: 'Joseph',
      rows: [
        { id: 'j1', party: 'RMS', a: 491.9, b: 150.3, c: 341.600 },
        { id: 'j2', party: 'Thamim', a: 204.4, b: 56.6, c: 147.800 },
        { id: 'j3', party: 'Irfan', a: 206.5, b: 56.7, c: 149.800 },
        { id: 'j4', party: 'Rajendran', a: 207.6, b: 56.8, c: 150.800 },
        { id: 'j5', party: 'BBC', a: 196.7, b: 57.1, c: 139.600 },
        { id: 'j6', party: 'Parveen', a: 87.3, b: 23.2, c: 64.100 }
      ]
    },
    {
      id: 'sadiq',
      name: 'Sadiq',
      rows: [
        { id: 's1', party: 'RMS', a: 303.8, b: 94.9, c: 208.900 },
        { id: 's2', party: 'Masthan', a: 202.7, b: 61.9, c: 140.800 }
      ]
    }
  ],
  otherCalculations: {
    title: 'Section F',
    items: [
      { id: 'o1', name: 'Anas', value: 12.000 },
      { id: 'o2', name: 'Anna city', value: 51.600 },
      { id: 'o3', name: 'B. Less', value: 1.800 },
      { id: 'o4', name: 'Sk', value: 6.800 },
      { id: 'o5', name: 'RMS', value: 10.000 },
      { id: 'o6', name: 'Saleem Bhai', value: 16.000 },
      { id: 'o7', name: 'Ramesh', value: 0.350 },
      { id: 'o8', name: 'School', value: 0.000 },
      { id: 'o9', name: '110', value: 9.300 },
      { id: 'o10', name: 'Daas', value: 2.200 },
      { id: 'o11', name: 'Mahendran', value: 1.000 }
    ]
  },
  totalsOverview: [
    { id: 't1', party: 'Joseph', total: 993.700 },
    { id: 't2', party: 'Sadiq', total: 349.700 },
    { id: 't3', party: 'M.Iruppu', total: 38.500 },
    { id: 't4', party: 'Thamim', total: 137.200, highlight: true },
    { id: 't5', party: 'Irfan', total: 117.400, highlight: true },
    { id: 't6', party: 'Rajendran', total: 137.700, highlight: true },
    { id: 't7', party: 'BBC', total: 128.800, highlight: true },
    { id: 't8', party: 'Parveen', total: 64.100, highlight: true },
    { id: 't9', party: 'Masthan', total: 140.800 },
    { id: 't10', party: 'Al Ayaan', total: 14.900 },
    { id: 't11', party: 'MBB', total: 56.400 },
    { id: 't12', party: 'F', total: 151.500, highlight: true },
    { id: 't13', party: 'Anas', total: 64.800 },
    { id: 't14', party: 'Iruppu', total: 15.000 }
  ],
  financial: [
    { id: 'f1', name: 'RMS', amount: 73700 },
    { id: 'f2', name: 'Thamim', amount: 24284 },
    { id: 'f3', name: 'Irfan', amount: 20780 },
    { id: 'f4', name: 'Rajendran', amount: 24373 },
    { id: 'f5', name: 'BBC', amount: 22798 },
    { id: 'f6', name: 'Parveen', amount: 11153 },
    { id: 'f7', name: 'Masthan', amount: 24922 },
    { id: 'f8', name: 'MBB', amount: 11030 },
    { id: 'f9', name: 'Al Ayaan', amount: 2915 },
    { id: 'f10', name: 'Anas', amount: 16330 },
    { id: 'f11', name: 'Anna city', amount: 14009, highlight: true },
    { id: 'f12', name: 'B. Less', amount: 576 },
    { id: 'f13', name: 'Saleem Bhai', amount: 4659 },
    { id: 'f14', name: 'Ramesh', amount: 100 },
    { id: 'f15', name: 'School', amount: 0 },
    { id: 'f16', name: '110', amount: 3330 },
    { id: 'f17', name: 'Daas', amount: 0 },
    { id: 'f18', name: 'Mahendran', amount: 360 },
    { id: 'f19', name: 'Iruppu', amount: 2505, highlight: true }
  ]
};
