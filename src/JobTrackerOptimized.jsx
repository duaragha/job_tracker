import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { FixedSizeList as List } from "react-window";
import {
  Box,
  Container,
  Heading,
  Text,
  Input,
  Select,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Badge,
  IconButton,
  useColorMode,
  useColorModeValue,
  Flex,
  VStack,
  HStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spinner,
  Center,
  InputGroup,
  InputLeftElement,
  Checkbox,
} from "@chakra-ui/react";
import { SearchIcon, SunIcon, MoonIcon, AddIcon } from "@chakra-ui/icons";

// Memoized AutocompleteInput with caching
const AutocompleteInput = React.memo(({ value, onChange, suggestions = [], placeholder, field, ...props }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const inputRef = useRef();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const hoverBg = useColorModeValue("gray.100", "gray.700");
  const filterTimeoutRef = useRef();

  // Memoized filtering with debounce
  useEffect(() => {
    clearTimeout(filterTimeoutRef.current);
    filterTimeoutRef.current = setTimeout(() => {
      if (value && suggestions.length > 0 && value.length >= 2) {
        const filtered = suggestions.filter(s => 
          s.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 5);
        setFilteredSuggestions(filtered);
      } else {
        setFilteredSuggestions([]);
      }
    }, 100);
  }, [value, suggestions]);

  const handleChange = useCallback((e) => {
    onChange(e);
    setShowSuggestions(true);
  }, [onChange]);

  return (
    <Box position="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        size="md"
        {...props}
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <Box
          position="absolute"
          top="100%"
          left={0}
          right={0}
          zIndex={10}
          bg={bgColor}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="md"
          mt={1}
          maxH="120px"
          overflowY="auto"
          boxShadow="md"
        >
          {filteredSuggestions.map((suggestion, idx) => (
            <Box
              key={idx}
              p={2}
              cursor="pointer"
              fontSize="sm"
              _hover={{ bg: hoverBg }}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange({ target: { value: suggestion } });
                setShowSuggestions(false);
              }}
            >
              {suggestion}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value && 
         prevProps.suggestions === nextProps.suggestions;
});

// Bulk Edit Toolbar Component
const BulkEditToolbar = React.memo(({
  selectedCount,
  bulkEditValues,
  setBulkEditValues,
  onApplyBulkEdit,
  onClearSelection,
  suggestions,
  statusOptions
}) => {
  const bgColor = useColorModeValue("blue.50", "blue.900");
  const borderColor = useColorModeValue("blue.200", "blue.600");

  return (
    <Box
      p={4}
      bg={bgColor}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="lg"
      mb={4}
    >
      <HStack spacing={4} align="flex-start">
        <Text fontWeight="bold" color="blue.600">
          {selectedCount} job{selectedCount !== 1 ? 's' : ''} selected
        </Text>

        <HStack spacing={2} flex={1}>
          <Select
            placeholder="Change Status"
            value={bulkEditValues.status || ""}
            onChange={(e) => setBulkEditValues(prev => ({ ...prev, status: e.target.value }))}
            size="sm"
            maxW="200px"
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>

          <Input
            type="date"
            placeholder="Applied Date"
            value={bulkEditValues.appliedDate || ""}
            onChange={(e) => setBulkEditValues(prev => ({ ...prev, appliedDate: e.target.value }))}
            size="sm"
            maxW="150px"
          />

          <Input
            type="date"
            placeholder="Rejection Date"
            value={bulkEditValues.rejectionDate || ""}
            onChange={(e) => setBulkEditValues(prev => ({ ...prev, rejectionDate: e.target.value }))}
            size="sm"
            maxW="150px"
          />
        </HStack>

        <HStack spacing={2}>
          <Button
            size="sm"
            colorScheme="blue"
            onClick={onApplyBulkEdit}
            isDisabled={Object.keys(bulkEditValues).length === 0}
          >
            Apply Changes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClearSelection}
          >
            Clear Selection
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
});

// Memoized JobRow component
const JobRow = React.memo(({ job, jobIndex, updateJobField, suggestions, statusOptions, selectedJobs, onToggleSelection }) => {
  const bgHover = useColorModeValue("gray.50", "gray.700");
  const handleFieldChange = useCallback((field, value) => {
    updateJobField(job.id, jobIndex, field, value);
  }, [job.id, jobIndex, updateJobField]);

  const isSelected = selectedJobs.has(job.id);

  return (
    <Tr _hover={{ bg: bgHover }} bg={isSelected ? useColorModeValue("blue.50", "blue.900") : "transparent"}>
      <Td>
        <Checkbox
          isChecked={isSelected}
          onChange={() => onToggleSelection(job.id)}
          colorScheme="blue"
        />
      </Td>
      <Td>
        <AutocompleteInput
          value={job.company || ""}
          onChange={(e) => handleFieldChange("company", e.target.value)}
          suggestions={suggestions.company}
          placeholder="Enter company"
          field="company"
        />
      </Td>
      <Td>
        <AutocompleteInput
          value={job.position || ""}
          onChange={(e) => handleFieldChange("position", e.target.value)}
          suggestions={suggestions.position}
          placeholder="Enter position"
          field="position"
        />
      </Td>
      <Td>
        <AutocompleteInput
          value={job.location || ""}
          onChange={(e) => handleFieldChange("location", e.target.value)}
          suggestions={suggestions.location}
          placeholder="Enter location"
          field="location"
        />
      </Td>
      <Td>
        <Select
          value={job.status || ""}
          onChange={(e) => handleFieldChange("status", e.target.value)}
          size="md"
        >
          <option value="">Select</option>
          {statusOptions.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </Td>
      <Td>
        <Input
          type="date"
          value={job.appliedDate || ""}
          onChange={(e) => handleFieldChange("appliedDate", e.target.value)}
          size="md"
        />
      </Td>
      <Td>
        <Input
          type="date"
          value={job.rejectionDate || ""}
          onChange={(e) => handleFieldChange("rejectionDate", e.target.value)}
          size="md"
        />
      </Td>
      <Td>
        <AutocompleteInput
          value={job.jobSite || ""}
          onChange={(e) => handleFieldChange("jobSite", e.target.value)}
          suggestions={suggestions.jobSite}
          placeholder="Enter job site"
          field="jobSite"
        />
      </Td>
      <Td>
        <AutocompleteInput
          value={job.url || ""}
          onChange={(e) => handleFieldChange("url", e.target.value)}
          suggestions={suggestions.url}
          placeholder="Enter URL"
          field="url"
        />
      </Td>
    </Tr>
  );
}, (prevProps, nextProps) => {
  // Deep comparison of job object properties instead of reference comparison
  const jobEqual = prevProps.job.id === nextProps.job.id &&
                  prevProps.job.company === nextProps.job.company &&
                  prevProps.job.position === nextProps.job.position &&
                  prevProps.job.location === nextProps.job.location &&
                  prevProps.job.status === nextProps.job.status &&
                  prevProps.job.appliedDate === nextProps.job.appliedDate &&
                  prevProps.job.rejectionDate === nextProps.job.rejectionDate &&
                  prevProps.job.jobSite === nextProps.job.jobSite &&
                  prevProps.job.url === nextProps.job.url;

  const suggestionsEqual = prevProps.suggestions === nextProps.suggestions;

  return jobEqual && suggestionsEqual;
});

// Virtual scrolling row renderer
const VirtualRow = React.memo(({ index, style, data }) => {
  const { jobs, updateJobField, suggestions, statusOptions, bgHover, borderColor, allJobs, jobIndexMap } = data;
  const job = jobs[index];
  // Use pre-computed job index map for O(1) lookup instead of O(n) findIndex
  const actualJobIndex = jobIndexMap ? jobIndexMap.get(job.id) : (allJobs ? allJobs.findIndex(j => j.id === job.id) : index);

  const handleFieldChange = useCallback((field, value) => {
    updateJobField(job.id, actualJobIndex, field, value);
  }, [job.id, actualJobIndex, updateJobField]);

  return (
    <Box style={style} display="flex" alignItems="center" px={4} borderBottom="1px solid" borderColor={borderColor} _hover={{ bg: bgHover }}>
      <Box flex="1" minW="200px" maxW="250px" pr={2}>
        <AutocompleteInput
          value={job.company || ""}
          onChange={(e) => handleFieldChange("company", e.target.value)}
          suggestions={suggestions.company}
          placeholder="Company"
          field="company"
        />
      </Box>
      <Box flex="1" minW="250px" maxW="350px" pr={2}>
        <AutocompleteInput
          value={job.position || ""}
          onChange={(e) => handleFieldChange("position", e.target.value)}
          suggestions={suggestions.position}
          placeholder="Position"
          field="position"
        />
      </Box>
      <Box flex="1" minW="200px" maxW="250px" pr={2}>
        <AutocompleteInput
          value={job.location || ""}
          onChange={(e) => handleFieldChange("location", e.target.value)}
          suggestions={suggestions.location}
          placeholder="Location"
          field="location"
        />
      </Box>
      <Box minW="150px" maxW="180px" pr={2}>
        <Select
          value={job.status || ""}
          onChange={(e) => handleFieldChange("status", e.target.value)}
          size="md"
        >
          <option value="">Select</option>
          {statusOptions.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </Box>
      <Box minW="150px" maxW="180px" pr={2}>
        <Input
          type="date"
          value={job.appliedDate || ""}
          onChange={(e) => handleFieldChange("appliedDate", e.target.value)}
          size="md"
        />
      </Box>
      <Box minW="150px" maxW="180px" pr={2}>
        <Input
          type="date"
          value={job.rejectionDate || ""}
          onChange={(e) => handleFieldChange("rejectionDate", e.target.value)}
          size="md"
        />
      </Box>
      <Box flex="1" minW="200px" maxW="250px" pr={2}>
        <AutocompleteInput
          value={job.jobSite || ""}
          onChange={(e) => handleFieldChange("jobSite", e.target.value)}
          suggestions={suggestions.jobSite}
          placeholder="Job Site"
          field="jobSite"
        />
      </Box>
      <Box flex="1" minW="300px" pr={2}>
        <AutocompleteInput
          value={job.url || ""}
          onChange={(e) => handleFieldChange("url", e.target.value)}
          suggestions={suggestions.url}
          placeholder="URL"
          field="url"
        />
      </Box>
    </Box>
  );
}, (prevProps, nextProps) => {
  // Compare the job object and relevant data properties
  const jobEqual = prevProps.data.jobs[prevProps.index]?.id === nextProps.data.jobs[nextProps.index]?.id &&
                  prevProps.data.jobs[prevProps.index]?.company === nextProps.data.jobs[nextProps.index]?.company &&
                  prevProps.data.jobs[prevProps.index]?.position === nextProps.data.jobs[nextProps.index]?.position &&
                  prevProps.data.jobs[prevProps.index]?.location === nextProps.data.jobs[nextProps.index]?.location &&
                  prevProps.data.jobs[prevProps.index]?.status === nextProps.data.jobs[nextProps.index]?.status &&
                  prevProps.data.jobs[prevProps.index]?.appliedDate === nextProps.data.jobs[nextProps.index]?.appliedDate &&
                  prevProps.data.jobs[prevProps.index]?.rejectionDate === nextProps.data.jobs[nextProps.index]?.rejectionDate &&
                  prevProps.data.jobs[prevProps.index]?.jobSite === nextProps.data.jobs[nextProps.index]?.jobSite &&
                  prevProps.data.jobs[prevProps.index]?.url === nextProps.data.jobs[nextProps.index]?.url;

  const dataEqual = prevProps.data.suggestions === nextProps.data.suggestions;

  return jobEqual && dataEqual && prevProps.index === nextProps.index;
});

// Search indexing class for O(1) search
class SearchIndex {
  constructor() {
    this.index = new Map();
    this.jobMap = new Map();
  }

  buildIndex(jobs) {
    this.index.clear();
    this.jobMap.clear();
    
    jobs.forEach(job => {
      this.jobMap.set(job.id, job);
      const searchableText = [
        job.company,
        job.position,
        job.location,
        job.status,
        job.jobSite,
        job.url
      ].filter(Boolean).join(' ').toLowerCase();
      
      // Create n-grams for partial matching
      const tokens = searchableText.split(/\s+/);
      tokens.forEach(token => {
        for (let i = 2; i <= token.length; i++) {
          const ngram = token.substring(0, i);
          if (!this.index.has(ngram)) {
            this.index.set(ngram, new Set());
          }
          this.index.get(ngram).add(job.id);
        }
      });
    });
  }

  search(query) {
    if (!query || query.trim().length < 2) return [];
    
    const queryTokens = query.toLowerCase().split(/\s+/);
    const resultSets = queryTokens.map(token => this.index.get(token) || new Set());
    
    if (resultSets.length === 0) return [];
    
    // Find intersection of all result sets
    const intersection = resultSets.reduce((acc, set) => {
      return new Set([...acc].filter(x => set.has(x)));
    });
    
    return Array.from(intersection).map(id => this.jobMap.get(id));
  }
}

export default function JobTrackerOptimized() {
  const statusOptions = [
    "Applied",
    "Assessment",
    "Interviewing",
    "Rejected",
    "Screening",
  ];

  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [openMonths, setOpenMonths] = useState([]);
  const [savingStatus, setSavingStatus] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showVirtualized, setShowVirtualized] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditValues, setBulkEditValues] = useState({});
  const { colorMode, toggleColorMode } = useColorMode();
  const saveTimeouts = useRef({});
  const searchTimeout = useRef(null);
  const searchIndex = useRef(new SearchIndex());

  // Color mode values
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const mainBg = useColorModeValue("gray.50", "gray.900");
  const headingColor = useColorModeValue("gray.900", "white");
  const subtitleColor = useColorModeValue("gray.600", "gray.400");
  const textColor = useColorModeValue("gray.900", "white");

  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("appliedDate", { ascending: false })
        .limit(1000); // Start with reasonable limit

      if (error) {
        console.error("Error fetching jobs:", error);
      } else {
        setJobs(data || []);
        searchIndex.current.buildIndex(data || []);
        // Enable virtualization for large datasets
        if ((data || []).length > 100) {
          setShowVirtualized(true);
        }
      }
      setIsLoading(false);
    };

    fetchJobs();
  }, []);

  const updateJobField = useCallback((jobId, jobIndex, key, value) => {
    // If rejection date is set, automatically change status to "Rejected"
    let additionalUpdates = {};
    if (key === 'rejectionDate' && value) {
      additionalUpdates.status = 'Rejected';
    }

    // Update UI immediately with proper immutability
    setJobs(prevJobs => {
      const updatedJobs = [...prevJobs];
      // Create a completely new object to ensure React detects the change
      updatedJobs[jobIndex] = {
        ...updatedJobs[jobIndex],
        [key]: value,
        ...additionalUpdates,
        // Add a timestamp to force re-render detection
        lastModified: Date.now()
      };

      // Clear existing timeout
      if (saveTimeouts.current[jobIndex]) {
        clearTimeout(saveTimeouts.current[jobIndex]);
      }

      // Show saving status
      setIsSaving(true);

      // Rebuild search index immediately for updated data
      searchIndex.current.buildIndex(updatedJobs);

      // Debounce save to database
      saveTimeouts.current[jobIndex] = setTimeout(async () => {
        const jobToSave = updatedJobs[jobIndex];

        // Remove the lastModified timestamp before saving to database
        const { lastModified, ...sanitizedJob } = {
          ...jobToSave,
          appliedDate: jobToSave.appliedDate === "" ? null : jobToSave.appliedDate,
          rejectionDate: jobToSave.rejectionDate === "" ? null : jobToSave.rejectionDate,
        };

        if (jobId) {
          const { error } = await supabase
            .from("jobs")
            .update(sanitizedJob)
            .eq("id", jobId);

          if (error) {
            console.error("Error updating job:", error.message);
            setIsSaving(false);
          } else {
            setIsSaving(false);
          }
        } else {
          const { id: _, ...jobWithoutId } = sanitizedJob;
          const { data, error } = await supabase
            .from("jobs")
            .insert([jobWithoutId])
            .select();

          if (error || !data) {
            console.error("Error inserting job:", error?.message || "No data returned");
            setIsSaving(false);
          } else {
            // Update the job with the new ID from database
            setJobs(prevJobs => {
              const newJobs = [...prevJobs];
              newJobs[jobIndex] = { ...data[0], lastModified: Date.now() };
              searchIndex.current.buildIndex(newJobs);
              return newJobs;
            });
            setIsSaving(false);
          }
        }

        // Clear saving indicator after a short delay
        setTimeout(() => {
          setIsSaving(false);
        }, 500);
      }, 800);

      return updatedJobs;
    });
  }, []);

  const addRow = async () => {
    const today = new Date().toISOString().split('T')[0];
    const newJob = {
      company: "",
      position: "",
      location: "",
      status: "Applied",
      appliedDate: today,
      rejectionDate: null,
      jobSite: "",
      url: "",
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("jobs").insert([newJob]).select();

    if (error || !data) {
      console.error("Error inserting job:", error?.message || "No data returned");
    } else {
      setJobs(prev => {
        const newJobs = [data[0], ...prev];
        searchIndex.current.buildIndex(newJobs);
        return newJobs;
      });
    }
  };

  // Selection handlers
  const toggleJobSelection = (jobId) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const selectAll = (jobsToSelect = filteredJobs) => {
    const visibleJobIds = jobsToSelect.map(job => job.id);
    setSelectedJobs(new Set(visibleJobIds));
  };

  const clearSelection = () => {
    setSelectedJobs(new Set());
    setShowBulkEdit(false);
    setBulkEditValues({});
  };

  // Bulk edit handlers
  const handleBulkEdit = () => {
    if (selectedJobs.size > 0) {
      setShowBulkEdit(true);
      setBulkEditValues({});
    }
  };

  const applyBulkEdit = async () => {
    if (Object.keys(bulkEditValues).length === 0) return;

    setIsSaving(true);
    const selectedJobsList = Array.from(selectedJobs);

    // Update UI immediately
    setJobs(prevJobs => {
      const updatedJobs = prevJobs.map(job => {
        if (selectedJobs.has(job.id)) {
          return { ...job, ...bulkEditValues };
        }
        return job;
      });
      searchIndex.current.buildIndex(updatedJobs);
      return updatedJobs;
    });

    // Prepare sanitized updates
    const sanitizedUpdates = {
      ...bulkEditValues,
      appliedDate: bulkEditValues.appliedDate === "" ? null : bulkEditValues.appliedDate,
      rejectionDate: bulkEditValues.rejectionDate === "" ? null : bulkEditValues.rejectionDate,
    };

    // Batch update in database
    try {
      for (const jobId of selectedJobsList) {
        const { error } = await supabase
          .from("jobs")
          .update(sanitizedUpdates)
          .eq("id", jobId);

        if (error) {
          console.error(`Error updating job ${jobId}:`, error.message);
        }
      }
    } catch (error) {
      console.error("Error during bulk update:", error);
    }

    setIsSaving(false);
    clearSelection();
  };

  const toggleMonth = (month) => {
    setOpenMonths(prev =>
      prev.includes(month)
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };
  const getMonthYear = (dateStr) => {
    if (!dateStr) return "";
    // Parse date string as local date to avoid timezone issues
    const parts = dateStr.split('-');
    if (parts.length !== 3) return "";
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Month is 0-indexed in Date constructor
    const day = parseInt(parts[2]);
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return "";
    return `${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
  };

  // Memoized grouping by month
  const jobsByMonth = useMemo(() => {
    const groups = {};
    jobs.forEach(job => {
      const month = getMonthYear(job.appliedDate);
      if (month) {
        if (!groups[month]) groups[month] = [];
        groups[month].push(job);
      }
    });
    return groups;
  }, [jobs]);
  // Memoized filtered jobs using search index
  const filteredJobs = useMemo(() => {
    if (!filter.trim()) return jobs;
    
    // Use search index for fast lookup
    const results = searchIndex.current.search(filter);
    return results.length > 0 ? results : jobs.filter(job => {
      const lowerFilter = filter.toLowerCase();
      return (
        (job.company || "").toLowerCase().includes(lowerFilter) ||
        (job.position || "").toLowerCase().includes(lowerFilter) ||
        (job.location || "").toLowerCase().includes(lowerFilter) ||
        (job.status || "").toLowerCase().includes(lowerFilter)
      );
    });
  }, [filter, jobs]);
  const unsavedJobs = useMemo(() => 
    jobs.filter(j => !j.appliedDate),
    [jobs]
  );

  // Memoized stats calculation
  const stats = useMemo(() => {
    // Calculate most applied day
    const applicationsByDate = {};
    jobs.forEach(job => {
      if (job.appliedDate) {
        const date = job.appliedDate;
        applicationsByDate[date] = (applicationsByDate[date] || 0) + 1;
      }
    });
    
    let mostAppliedDate = null;
    let maxApplications = 0;
    Object.entries(applicationsByDate).forEach(([date, count]) => {
      if (count > maxApplications) {
        maxApplications = count;
        mostAppliedDate = date;
      }
    });
    
    // Format the most applied date
    let formattedMostAppliedDate = "N/A";
    if (mostAppliedDate) {
      const date = new Date(mostAppliedDate);
      formattedMostAppliedDate = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    }
    
    return {
      Applied: jobs.filter(j => j.status === "Applied").length,
      Interviewing: jobs.filter(j => j.status === "Interviewing").length,
      Rejected: jobs.filter(j => j.status === "Rejected").length,
      Assessment: jobs.filter(j => j.status === "Assessment").length,
      Screening: jobs.filter(j => j.status === "Screening").length,
      Total: jobs.length,
      MostAppliedDate: formattedMostAppliedDate,
      MostAppliedCount: maxApplications
    };
  }, [jobs]);

  // Memoized suggestions generation
  const suggestions = useMemo(() => ({
    company: [...new Set(jobs.map(j => j.company).filter(Boolean))],
    position: [...new Set(jobs.map(j => j.position).filter(Boolean))],
    location: [...new Set(jobs.map(j => j.location).filter(Boolean))],
    jobSite: [...new Set(jobs.map(j => j.jobSite).filter(Boolean))],
    url: [...new Set(jobs.map(j => j.url).filter(Boolean))]
  }), [jobs]);

  // Memoized job index map for O(1) lookups in virtual scrolling
  const jobIndexMap = useMemo(() => {
    const map = new Map();
    jobs.forEach((job, index) => {
      if (job.id) {
        map.set(job.id, index);
      }
    });
    return map;
  }, [jobs]);
  // Debounced search handler
  const handleSearch = useCallback((value) => {
    setSearchInput(value);
    
    // Clear existing timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    // Set new timeout for debounced search
    searchTimeout.current = setTimeout(() => {
      setFilter(value);
    }, 200);
  }, []);

  if (isLoading) {
    return (
      <Box minH="100vh" bg={mainBg} py={8}>
        <Container maxW="full" px={4}>
          <Center h="50vh">
            <VStack spacing={4}>
              <Spinner size="xl" color="brand.500" thickness="4px" />
              <Text color={subtitleColor}>Loading your job applications...</Text>
            </VStack>
          </Center>
        </Container>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg={mainBg} py={8}>
      <Container maxW="full" px={4}>
        {/* Saving Indicator */}
        {isSaving && (
          <Box 
            position="fixed" 
            top={4} 
            right={4} 
            zIndex={1000}
            bg={bgColor}
            p={3}
            borderRadius="md"
            boxShadow="lg"
            border="1px solid"
            borderColor={borderColor}
          >
            <HStack spacing={2}>
              <Spinner size="sm" color="brand.500" />
              <Text fontSize="sm" color={textColor}>Saving...</Text>
            </HStack>
          </Box>
        )}

        {/* Header */}
        <Box bg={bgColor} p={6} borderRadius="lg" mb={8} border="1px solid" borderColor={borderColor}>
          <Flex align="center">
            <VStack align="start" flex={1}>
              <Heading size="2xl" color={headingColor}>
                Job Application Tracker (Optimized)
              </Heading>
              <Text fontSize="lg" color={subtitleColor}>
                High-performance tracker for 10,000+ applications
              </Text>
            </VStack>
            <IconButton
              icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
              onClick={toggleColorMode}
              variant="outline"
              size="lg"
              aria-label="Toggle dark mode"
            />
          </Flex>
        </Box>

        {/* Search */}
        <Box bg={bgColor} p={4} borderRadius="lg" mb={6} border="1px solid" borderColor={borderColor}>
          <InputGroup size="lg">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Instant search with indexing..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchInput('');
                  setFilter('');
                }
              }}
              bg={bgColor}
              border="1px solid"
              borderColor={borderColor}
            />
          </InputGroup>
        </Box>

        {/* Bulk Edit Toolbar */}
        {selectedJobs.size > 0 && (
          <BulkEditToolbar
            selectedCount={selectedJobs.size}
            bulkEditValues={bulkEditValues}
            setBulkEditValues={setBulkEditValues}
            onApplyBulkEdit={applyBulkEdit}
            onClearSelection={clearSelection}
            suggestions={suggestions}
            statusOptions={statusOptions}
          />
        )}

        {/* Stats */}
        {!filter.trim() && (
          <SimpleGrid columns={{ base: 2, md: 3, lg: 7 }} spacing={4} mb={6}>
            <Stat bg={bgColor} p={4} borderRadius="lg" borderLeft="4px solid" borderLeftColor="brand.500">
              <StatLabel>Applied</StatLabel>
              <StatNumber>{stats.Applied}</StatNumber>
              <StatHelpText>{stats.Total > 0 ? ((stats.Applied / stats.Total) * 100).toFixed(1) : 0}%</StatHelpText>
            </Stat>
            <Stat bg={bgColor} p={4} borderRadius="lg" borderLeft="4px solid" borderLeftColor="green.500">
              <StatLabel>Interviewing</StatLabel>
              <StatNumber>{stats.Interviewing}</StatNumber>
              <StatHelpText>{stats.Total > 0 ? ((stats.Interviewing / stats.Total) * 100).toFixed(1) : 0}%</StatHelpText>
            </Stat>
            <Stat bg={bgColor} p={4} borderRadius="lg" borderLeft="4px solid" borderLeftColor="red.500">
              <StatLabel>Rejected</StatLabel>
              <StatNumber>{stats.Rejected}</StatNumber>
              <StatHelpText>{stats.Total > 0 ? ((stats.Rejected / stats.Total) * 100).toFixed(1) : 0}%</StatHelpText>
            </Stat>
            <Stat bg={bgColor} p={4} borderRadius="lg" borderLeft="4px solid" borderLeftColor="orange.500">
              <StatLabel>Assessment</StatLabel>
              <StatNumber>{stats.Assessment}</StatNumber>
              <StatHelpText>{stats.Total > 0 ? ((stats.Assessment / stats.Total) * 100).toFixed(1) : 0}%</StatHelpText>
            </Stat>
            <Stat bg={bgColor} p={4} borderRadius="lg" borderLeft="4px solid" borderLeftColor="blue.500">
              <StatLabel>Screening</StatLabel>
              <StatNumber>{stats.Screening}</StatNumber>
              <StatHelpText>{stats.Total > 0 ? ((stats.Screening / stats.Total) * 100).toFixed(1) : 0}%</StatHelpText>
            </Stat>
            <Stat bg={bgColor} p={4} borderRadius="lg" borderLeft="4px solid" borderLeftColor="gray.600">
              <StatLabel>Total Jobs</StatLabel>
              <StatNumber>{stats.Total}</StatNumber>
              <StatHelpText>All applications</StatHelpText>
            </Stat>
            <Stat bg={bgColor} p={4} borderRadius="lg" borderLeft="4px solid" borderLeftColor="purple.500">
              <StatLabel>Most Applied Day</StatLabel>
              <StatNumber>{stats.MostAppliedCount}</StatNumber>
              <StatHelpText>{stats.MostAppliedDate}</StatHelpText>
            </Stat>
          </SimpleGrid>
        )}

        {/* Add New Application Button */}
        {!filter.trim() && (
          <Box bg={bgColor} p={4} borderRadius="lg" mb={6} border="1px solid" borderColor={borderColor}>
            <Button
              leftIcon={<AddIcon />}
              colorScheme="brand"
              size="lg"
              onClick={addRow}
            >
              Add New Application
            </Button>
          </Box>
        )}

        {/* Filtered Results with Virtual Scrolling */}
        {filter.trim() && filteredJobs.length > 50 ? (
          <Box bg={bgColor} borderRadius="lg" overflow="hidden" border="1px solid" borderColor={borderColor}>
            <Box p={4} borderBottom="1px solid" borderColor={borderColor}>
              <Flex fontWeight="bold" fontSize="sm" color={subtitleColor}>
                <Box flex="1" minW="200px" maxW="250px" pr={2}>Company</Box>
                <Box flex="1" minW="250px" maxW="350px" pr={2}>Position</Box>
                <Box flex="1" minW="200px" maxW="250px" pr={2}>Location</Box>
                <Box minW="150px" maxW="180px" pr={2}>Status</Box>
                <Box minW="150px" maxW="180px" pr={2}>Applied Date</Box>
                <Box minW="150px" maxW="180px" pr={2}>Rejection Date</Box>
                <Box flex="1" minW="200px" maxW="250px" pr={2}>Job Site</Box>
                <Box flex="1" minW="300px" pr={2}>URL</Box>
              </Flex>
            </Box>
            <List
              height={600}
              itemCount={filteredJobs.length}
              itemSize={60}
              itemData={{
                jobs: filteredJobs,
                allJobs: jobs,
                updateJobField,
                suggestions,
                statusOptions,
                bgHover: useColorModeValue("gray.50", "gray.700"),
                borderColor: borderColor,
                jobIndexMap: jobIndexMap
              }}
              overscanCount={5}
            >
              {VirtualRow}
            </List>
          </Box>
        ) : filter.trim() ? (
          <Box bg={bgColor} borderRadius="lg" overflow="hidden" border="1px solid" borderColor={borderColor}>
            <TableContainer>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>
                      <Checkbox
                        isChecked={selectedJobs.size > 0 && selectedJobs.size === filteredJobs.length}
                        isIndeterminate={selectedJobs.size > 0 && selectedJobs.size < filteredJobs.length}
                        onChange={(e) => e.target.checked ? selectAll(filteredJobs) : clearSelection()}
                        colorScheme="blue"
                      />
                    </Th>
                    <Th>Company</Th>
                    <Th>Position</Th>
                    <Th>Location</Th>
                    <Th>Status</Th>
                    <Th>Applied Date</Th>
                    <Th>Rejection Date</Th>
                    <Th>Job Site</Th>
                    <Th>URL</Th>                  </Tr>
                </Thead>
                <Tbody>
                  {filteredJobs.map((job) => {
                    const jobIndex = jobs.findIndex(j => j.id === job.id);
                    return (
                      <JobRow
                        key={job.id || `filtered-${jobIndex}`}
                        job={job}
                        jobIndex={jobIndex}
                        updateJobField={updateJobField}
                        suggestions={suggestions}
                        statusOptions={statusOptions}
                        selectedJobs={selectedJobs}
                        onToggleSelection={toggleJobSelection}
                      />
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          /* Lazy Loading Monthly Accordion */
          <Accordion allowMultiple index={Object.keys(jobsByMonth).map((month, idx) =>
            openMonths.includes(month) ? idx : -1
          ).filter(idx => idx !== -1)}>
            {Object.keys(jobsByMonth).map((month) => {
              const monthJobs = jobsByMonth[month];
              // Calculate stats directly without useMemo (can't use hooks inside map)
              const monthStats = {
                Applied: monthJobs.filter(j => j.status === "Applied").length,
                Interviewing: monthJobs.filter(j => j.status === "Interviewing").length,
                Rejected: monthJobs.filter(j => j.status === "Rejected").length,
                Assessment: monthJobs.filter(j => j.status === "Assessment").length,
                Screening: monthJobs.filter(j => j.status === "Screening").length,
              };

              return (
                <AccordionItem 
                  key={month} 
                  bg={bgColor} 
                  mb={4} 
                  borderRadius="lg" 
                  border="1px solid" 
                  borderColor={borderColor}
                >
                  <h2>
                    <AccordionButton onClick={() => toggleMonth(month)} p={4}>
                      <Box flex="1" textAlign="left">
                        <Heading size="md" mb={2}>{month}</Heading>
                        <HStack spacing={3}>
                          <Badge colorScheme="blue">Applied: {monthStats.Applied}</Badge>
                          <Badge colorScheme="green">Interviewing: {monthStats.Interviewing}</Badge>
                          <Badge colorScheme="red">Rejected: {monthStats.Rejected}</Badge>
                          <Badge colorScheme="orange">Assessment: {monthStats.Assessment}</Badge>
                          <Badge colorScheme="cyan">Screening: {monthStats.Screening}</Badge>
                        </HStack>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                  </h2>
                  <AccordionPanel pb={4} px={0}>
                    {openMonths.includes(month) && (
                      monthJobs.length > 20 ? (
                        <Box>
                          <Box p={4} borderBottom="1px solid" borderColor={borderColor}>
                            <Flex fontWeight="bold" fontSize="sm" color={subtitleColor}>
                              <Box flex="1" minW="200px" maxW="250px" pr={2}>Company</Box>
                              <Box flex="1" minW="250px" maxW="350px" pr={2}>Position</Box>
                              <Box flex="1" minW="200px" maxW="250px" pr={2}>Location</Box>
                              <Box minW="150px" maxW="180px" pr={2}>Status</Box>
                              <Box minW="150px" maxW="180px" pr={2}>Applied Date</Box>
                              <Box minW="150px" maxW="180px" pr={2}>Rejection Date</Box>
                              <Box flex="1" minW="200px" maxW="250px" pr={2}>Job Site</Box>
                              <Box flex="1" minW="300px" pr={2}>URL</Box>
                            </Flex>
                          </Box>
                          <List
                            height={400}
                            itemCount={monthJobs.length}
                            itemSize={60}
                            itemData={{
                              jobs: monthJobs,
                              allJobs: jobs,
                              updateJobField,
                              suggestions,
                              statusOptions,
                              bgHover: useColorModeValue("gray.50", "gray.700"),
                              borderColor: borderColor,
                              jobIndexMap: jobIndexMap
                            }}
                            overscanCount={3}
                          >
                            {VirtualRow}
                          </List>
                        </Box>
                      ) : (
                        <TableContainer>
                          <Table variant="simple" size="sm">
                            <Thead>
                              <Tr>
                                <Th>
                                  <Checkbox
                                    isChecked={selectedJobs.size > 0 && monthJobs.every(job => selectedJobs.has(job.id))}
                                    isIndeterminate={selectedJobs.size > 0 && monthJobs.some(job => selectedJobs.has(job.id)) && !monthJobs.every(job => selectedJobs.has(job.id))}
                                    onChange={(e) => e.target.checked ? selectAll(monthJobs) : clearSelection()}
                                    colorScheme="blue"
                                  />
                                </Th>
                                <Th>Company</Th>
                                <Th>Position</Th>
                                <Th>Location</Th>
                                <Th>Status</Th>
                                <Th>Applied Date</Th>
                                <Th>Rejection Date</Th>
                                <Th>Job Site</Th>
                                <Th>URL</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {monthJobs.map((job) => {
                                const jobIndex = jobs.findIndex(j => j.id === job.id);
                                return (
                                  <JobRow
                                    key={job.id || `month-${jobIndex}`}
                                    job={job}
                                    jobIndex={jobIndex}
                                    updateJobField={updateJobField}
                                    suggestions={suggestions}
                                    statusOptions={statusOptions}
                                    selectedJobs={selectedJobs}
                                    onToggleSelection={toggleJobSelection}
                                  />
                                );
                              })}
                            </Tbody>
                          </Table>
                        </TableContainer>
                      )
                    )}
                  </AccordionPanel>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </Container>
    </Box>
  );
}