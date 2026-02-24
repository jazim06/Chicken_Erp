import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { StatBar } from '../components/StatBar';
import { SubPartyList } from '../components/SubPartyList';
import { EntriesTable } from '../components/EntriesTable';
import { WeightEntryModal } from '../components/WeightEntryModal';
import { getSupplierById, getEntriesByDate, saveEntry, updateWeightEntry, addSubParty, deleteSubParty, deleteWeightEntry } from '../utils/apiAdapter';
import { useAppContext } from '../context/AppContext';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const SupplierManagementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [supplier, setSupplier] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    loadSupplierData();
  }, [id]);

  useEffect(() => {
    if (supplier) {
      loadEntries();
    }
  }, [selectedDate, supplier]);

  const { setLastSupplier } = useAppContext();

  const loadSupplierData = async () => {
    try {
      const data = await getSupplierById(id);
      setSupplier(data);
      // Track this supplier in the global sidebar context
      setLastSupplier(data.id, data.name, data.productType);
    } catch (error) {
      console.error('Failed to load supplier:', error);
      toast.error('Failed to load supplier data');
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoadingEntries(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      console.log(`Loading entries for date: ${dateStr}, supplier: ${id}`);
      const data = await getEntriesByDate(id, dateStr);
      setEntries(data || []);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to load entries:', error);
        toast.error('Failed to load entries');
        setEntries([]);
      }
    } finally {
      setLoadingEntries(false);
    }
  };

  const handleAddEntry = (party) => {
    setSelectedParty(party);
    setEditingEntry(null);
    setModalOpen(true);
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setSelectedParty({ id: entry.partyId, name: entry.partyName });
    setModalOpen(true);
  };

  const handleSaveEntry = async (entryData) => {
    try {
      if (editingEntry?.id) {
        // Update existing entry
        await updateWeightEntry(editingEntry.id, entryData);
        toast.success('Entry updated successfully!');
      } else {
        // Create new entry
        await saveEntry({
          supplierId: id,
          partyId: selectedParty.id,
          partyName: selectedParty.name,
          date: format(selectedDate, 'yyyy-MM-dd'),
          ...entryData
        });
        toast.success('Entry saved successfully!');
      }
      setEditingEntry(null);
      await loadSupplierData();
      await loadEntries();
    } catch (error) {
      console.error('Failed to save entry:', error);
      toast.error('Failed to save entry');
    }
  };

  const handleAddSubParty = async (partyName) => {
    try {
      await addSubParty(id, partyName);
      toast.success('Sub-party added successfully!');
      await loadSupplierData();
    } catch (error) {
      console.error('Failed to add sub-party:', error);
      toast.error('Failed to add sub-party');
    }
  };

  const handleDeleteSubParty = async (subPartyId) => {
    try {
      await deleteSubParty(id, subPartyId);
      toast.success('Sub-party deleted successfully!');
      await loadSupplierData();
    } catch (error) {
      console.error('Failed to delete sub-party:', error);
      toast.error('Failed to delete sub-party');
    }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      await deleteWeightEntry(entryId);
      toast.success('Entry deleted successfully!');
      await loadEntries();
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  // Fixed sub-party ordering by supplier
  const SUB_PARTY_ORDER = {
    'Joseph': ['RMS', 'Thamim', 'Irfan', 'Rajendran', 'BBC', 'Parveen'],
    'Sadiq': ['RMS', 'Masthan'],
    'Other Calculation': ['Anas', 'Anna City', 'B.Less', 'Sk', 'RMS', 'Saleem Bhai', 'Ramesh', 'School', '110', 'Daas', 'Mahendran']
  };

  // Normalize a name for comparison: lowercase, remove spaces and dots
  const normalizeName = (name) => (name || '').toLowerCase().replace(/[\s.]+/g, '');

  // Find the index of a name in the order list using fuzzy matching
  const findOrderIndex = (name, order) => {
    const normalized = normalizeName(name);
    return order.findIndex(o => normalizeName(o) === normalized);
  };

  const sortSubPartiesBySupplier = (parties) => {
    const supplierName = supplier?.name;
    // Case-insensitive lookup for supplier name
    const orderKey = Object.keys(SUB_PARTY_ORDER).find(
      key => normalizeName(key) === normalizeName(supplierName)
    );
    const order = orderKey ? SUB_PARTY_ORDER[orderKey] : [];
    
    if (order.length === 0) {
      return parties; // No predefined order, return as-is
    }
    
    return [...parties].sort((a, b) => {
      const indexA = findOrderIndex(a.name, order);
      const indexB = findOrderIndex(b.name, order);
      
      // Items in order come first (sorted by order)
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1; // a is in order, comes first
      if (indexB !== -1) return 1;  // b is in order, comes first
      
      // Items not in order maintain alphabetical order
      return a.name.localeCompare(b.name);
    });
  };

  // Calculate stats from filtered entries for the selected date
  const totalWeight = entries.reduce((sum, entry) => sum + (entry.liveWeight || 0), 0);
  const activeParties = new Set(entries.map(e => e.partyName)).size;
  
  // Always show all sub-parties for this supplier, sorted by fixed order
  // Parties with entries get green highlighting, others remain available for adding entries
  const allSubParties = sortSubPartiesBySupplier(supplier?.subParties || []);

  // Sort entries by the same party order
  const sortedEntries = (() => {
    const supplierName = supplier?.name;
    const orderKey = Object.keys(SUB_PARTY_ORDER).find(
      key => normalizeName(key) === normalizeName(supplierName)
    );
    const order = orderKey ? SUB_PARTY_ORDER[orderKey] : [];
    
    if (order.length === 0) return entries;
    
    return [...entries].sort((a, b) => {
      const indexA = findOrderIndex(a.partyName, order);
      const indexB = findOrderIndex(b.partyName, order);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.partyName.localeCompare(b.partyName);
    });
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Supplier not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4 animate-fade-in">
          {/* Breadcrumb */}
          <button
            onClick={() => navigate(`/suppliers?product=${supplier.productType}`)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
            Back to Suppliers
          </button>

          {/* Title Row */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-wide text-foreground">
                {supplier.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage weight entries for {supplier.productType}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Date Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal w-full sm:w-[240px]",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Dashboard Button */}
              <Button
                onClick={() => navigate(`/supplier/${id}/dashboard`)}
                className="bg-primary hover:bg-primary-hover gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                View Dashboard
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="animate-slide-up">
          <StatBar
            todayEntries={entries.length}
            totalWeight={totalWeight}
            activeParties={activeParties}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-up">
          {/* Sub-Parties List - Left Side */}
          <div className="lg:col-span-4">
            <SubPartyList
              subParties={allSubParties}
              allSubParties={supplier.subParties}
              entries={entries}
              onAddEntry={handleAddEntry}
              onAddSubParty={handleAddSubParty}
              onDeleteSubParty={handleDeleteSubParty}
              selectedDate={format(selectedDate, 'yyyy-MM-dd')}
            />
          </div>

          {/* Entries Table - Right Side */}
          <div className="lg:col-span-8">
            {loadingEntries ? (
              <div className="p-8 rounded-lg border bg-card flex items-center justify-center min-h-[300px]">
                <div className="text-center space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">Loading entries...</p>
                </div>
              </div>
            ) : (
              <EntriesTable
                entries={sortedEntries}
                selectedDate={format(selectedDate, 'yyyy-MM-dd')}
                onEditEntry={handleEditEntry}
                onDeleteEntry={handleDeleteEntry}
              />
            )}
          </div>
        </div>
      </div>

      {/* Weight Entry Modal */}
      <WeightEntryModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEntry(null);
        }}
        party={selectedParty}
        onSave={handleSaveEntry}
        isRetail={id === 'supp_other_calc'}
        editingEntry={editingEntry}
      />
    </div>
  );
};

export default SupplierManagementPage;
