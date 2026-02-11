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

export const dashboardData = {
  suppliers: {
    joseph: {
      subParties: [
        { name: 'RMS', a: 150.500, b: 120.250, c: 30.250 },
        { name: 'Thamim', a: 200.000, b: 180.000, c: 20.000 },
        { name: 'Anna City', a: 180.750, b: 150.500, c: 30.250 }
      ],
      total: { a: 531.250, b: 450.750, c: 80.500 }
    },
    sadiq: {
      subParties: [
        { name: 'Party A', a: 100.000, b: 85.000, c: 15.000 },
        { name: 'Party B', a: 125.500, b: 110.250, c: 15.250 }
      ],
      total: { a: 225.500, b: 195.250, c: 30.250 }
    },
    other: [
      { name: 'Iruppu', amount: 45.750 },
      { name: 'Misc Items', amount: 32.250 }
    ]
  },
  totals: [
    { party: 'RMS', weight: 150.500 },
    { party: 'Thamim', weight: 200.000 },
    { party: 'Anna City', weight: 180.750, highlight: true },
    { party: 'Party A', weight: 100.000 },
    { party: 'Party B', weight: 125.500 },
    { party: 'Iruppu', weight: 45.750, highlight: true },
    { party: 'Misc', weight: 32.250 }
  ],
  subtotal: 834.750,
  financial: [
    { name: 'Joseph', amount: 257824 },
    { name: 'Sadiq', amount: 125430 },
    { name: 'Other Expenses', amount: 45600 },
    { name: 'Transport', amount: 12500 }
  ],
  grandTotal: 441354
};
