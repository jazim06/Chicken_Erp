import React, { useEffect, useState } from 'react';
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
import { getSupplierById, getEntriesByDate, saveEntry, addSubParty, deleteSubParty } from '../utils/apiAdapter';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSupplierData();
  }, [id]);

  useEffect(() => {
    if (supplier) {
      loadEntries();
    }
  }, [selectedDate, supplier]);

  const loadSupplierData = async () => {
    try {
      const data = await getSupplierById(id);
      setSupplier(data);
    } catch (error) {
      console.error('Failed to load supplier:', error);
      toast.error('Failed to load supplier data');
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const data = await getEntriesByDate(id, dateStr);
      setEntries(data);
    } catch (error) {
      console.error('Failed to load entries:', error);
    }
  };

  const handleAddEntry = (party) => {
    setSelectedParty(party);
    setModalOpen(true);
  };

  const handleSaveEntry = async (entryData) => {
    try {
      await saveEntry({
        supplierId: parseInt(id),
        subPartyId: selectedParty.id,
        partyName: selectedParty.name,
        date: format(selectedDate, 'yyyy-MM-dd'),
        ...entryData
      });
      toast.success('Entry saved successfully!');
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

  const totalWeight = supplier?.subParties.reduce((sum, party) => sum + party.todayWeight, 0) || 0;
  const activeParties = supplier?.subParties.filter(p => p.todayWeight > 0).length || 0;

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
              subParties={supplier.subParties}
              onAddEntry={handleAddEntry}
            />
          </div>

          {/* Entries Table - Right Side */}
          <div className="lg:col-span-8">
            <EntriesTable
              entries={entries}
              selectedDate={format(selectedDate, 'yyyy-MM-dd')}
            />
          </div>
        </div>
      </div>

      {/* Weight Entry Modal */}
      <WeightEntryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        party={selectedParty}
        onSave={handleSaveEntry}
      />
    </div>
  );
};

export default SupplierManagementPage;
