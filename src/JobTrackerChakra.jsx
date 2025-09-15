import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
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
  Spacer,
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
} from "@chakra-ui/react";
import { SearchIcon, SunIcon, MoonIcon, AddIcon } from "@chakra-ui/icons";

// AutocompleteInput component for handling datalist functionality
const AutocompleteInput = ({ value, onChange, suggestions = [], placeholder, ...props }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const inputRef = useRef();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const hoverBg = useColorModeValue("gray.100", "gray.700");

  useEffect(() => {
    if (value && suggestions.length > 0) {
      const filtered = suggestions.filter(s => 
        s.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, [value, suggestions]);

  return (
    <Box position="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        size="sm"
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
          maxH="200px"
          overflowY="auto"
          boxShadow="md"
        >
          {filteredSuggestions.map((suggestion, idx) => (
            <Box
              key={idx}
              p={2}
              cursor="pointer"
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
};

// JobRow component
const JobRow = ({ job, jobIndex, updateJobField, savingStatus, suggestions, statusOptions }) => {
  const bgHover = useColorModeValue("gray.50", "gray.700");
  
  return (
    <Tr _hover={{ bg: bgHover }}>
      <Td>
        <AutocompleteInput
          value={job.company || ""}
          onChange={(e) => updateJobField(job.id, jobIndex, "company", e.target.value)}
          suggestions={suggestions.company}
          placeholder="Enter company"
        />
      </Td>
      <Td>
        <AutocompleteInput
          value={job.position || ""}
          onChange={(e) => updateJobField(job.id, jobIndex, "position", e.target.value)}
          suggestions={suggestions.position}
          placeholder="Enter position"
        />
      </Td>
      <Td>
        <AutocompleteInput
          value={job.location || ""}
          onChange={(e) => updateJobField(job.id, jobIndex, "location", e.target.value)}
          suggestions={suggestions.location}
          placeholder="Enter location"
        />
      </Td>
      <Td>
        <Select
          value={job.status || ""}
          onChange={(e) => updateJobField(job.id, jobIndex, "status", e.target.value)}
          size="sm"
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
          onChange={(e) => updateJobField(job.id, jobIndex, "appliedDate", e.target.value)}
          size="sm"
        />
      </Td>
      <Td>
        <Input
          type="date"
          value={job.rejectionDate || ""}
          onChange={(e) => updateJobField(job.id, jobIndex, "rejectionDate", e.target.value)}
          size="sm"
        />
      </Td>
      <Td>
        <AutocompleteInput
          value={job.jobSite || ""}
          onChange={(e) => updateJobField(job.id, jobIndex, "jobSite", e.target.value)}
          suggestions={suggestions.jobSite}
          placeholder="Enter job site"
        />
      </Td>
      <Td>
        <AutocompleteInput
          value={job.url || ""}
          onChange={(e) => updateJobField(job.id, jobIndex, "url", e.target.value)}
          suggestions={suggestions.url}
          placeholder="Enter URL"
        />
      </Td>
      <Td>
        {savingStatus && (
          <Badge
            colorScheme={
              savingStatus.toLowerCase().includes('sav') ? 'gray' :
              savingStatus.toLowerCase().includes('error') ? 'red' : 'green'
            }
          >
            {savingStatus}
          </Badge>
        )}
      </Td>
    </Tr>
  );
};

export default function JobTrackerApp() {
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
  const [isLoading, setIsLoading] = useState(true);
  const { colorMode, toggleColorMode } = useColorMode();
  const saveTimeouts = useRef({});
  const searchTimeout = useRef(null);

  // Color mode values
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const mainBg = useColorModeValue("gray.50", "gray.900");
  const headingColor = useColorModeValue("gray.900", "white");
  const subtitleColor = useColorModeValue("gray.600", "gray.400");

  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("appliedDate", { ascending: false });

      if (error) {
        console.error("Error fetching jobs:", error);
      } else {
        setJobs(data || []);
      }
      setIsLoading(false);
    };

    fetchJobs();
  }, []);

  const updateJobField = (jobId, jobIndex, key, value) => {
    // If rejection date is set, automatically change status to "Rejected"
    let additionalUpdates = {};
    if (key === 'rejectionDate' && value) {
      additionalUpdates.status = 'Rejected';
    }

    // Update UI immediately
    setJobs(prevJobs => {
      const updatedJobs = prevJobs.map((job, index) =>
        index === jobIndex
          ? { ...job, [key]: value, ...additionalUpdates }
          : job
      );

      // Clear existing timeout
      if (saveTimeouts.current[jobIndex]) {
        clearTimeout(saveTimeouts.current[jobIndex]);
      }

      // Show saving status
      setSavingStatus(prev => ({ ...prev, [jobIndex]: "Saving..." }));

      // Debounce save to database
      saveTimeouts.current[jobIndex] = setTimeout(async () => {
        const jobToSave = updatedJobs[jobIndex];
        
        const sanitizedJob = {
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
            setSavingStatus(prev => ({ ...prev, [jobIndex]: "Error!" }));
          } else {
            setSavingStatus(prev => ({ ...prev, [jobIndex]: "Saved ✅" }));
          }
        } else {
          const { id: _, ...jobWithoutId } = sanitizedJob;
          const { data, error } = await supabase
            .from("jobs")
            .insert([jobWithoutId])
            .select();

          if (error || !data) {
            console.error("Error inserting job:", error?.message || "No data returned");
            setSavingStatus(prev => ({ ...prev, [jobIndex]: "Error!" }));
          } else {
            // Update the job with the new ID from database
            setJobs(prevJobs => prevJobs.map((j, i) =>
              i === jobIndex ? data[0] : j
            ));
            setSavingStatus(prev => ({ ...prev, [jobIndex]: "Saved ✅" }));
          }
        }

        // Clear status message after 2 seconds
        setTimeout(() => {
          setSavingStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[jobIndex];
            return newStatus;
          });
        }, 2000);
      }, 800);

      return updatedJobs;
    });
  };

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
      setJobs(prev => [data[0], ...prev]);
    }
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

  // Filter jobs
  const filteredJobs = filter.trim() 
    ? jobs.filter(job => {
        const lowerFilter = filter.toLowerCase();
        return (
          (job.company || "").toLowerCase().includes(lowerFilter) ||
          (job.position || "").toLowerCase().includes(lowerFilter) ||
          (job.location || "").toLowerCase().includes(lowerFilter) ||
          (job.status || "").toLowerCase().includes(lowerFilter) ||
          (job.jobSite || "").toLowerCase().includes(lowerFilter) ||
          (job.url || "").toLowerCase().includes(lowerFilter) ||
          (job.appliedDate || "").toLowerCase().includes(lowerFilter) ||
          (job.rejectionDate || "").toLowerCase().includes(lowerFilter)
        );
      })
    : jobs;

  // Group jobs by month
  const jobsByMonth = {};
  jobs.forEach(job => {
    const month = getMonthYear(job.appliedDate);
    if (month) {
      if (!jobsByMonth[month]) jobsByMonth[month] = [];
      jobsByMonth[month].push(job);
    }
  });

  const unsavedJobs = jobs.filter(j => !j.appliedDate);

  // Calculate stats
  const stats = {
    Applied: jobs.filter(j => j.status === "Applied").length,
    Interviewing: jobs.filter(j => j.status === "Interviewing").length,
    Rejected: jobs.filter(j => j.status === "Rejected").length,
    Assessment: jobs.filter(j => j.status === "Assessment").length,
    Screening: jobs.filter(j => j.status === "Screening").length,
    Total: jobs.length
  };

  // Generate suggestions for autocomplete
  const suggestions = {
    company: [...new Set(jobs.map(j => j.company).filter(Boolean))],
    position: [...new Set(jobs.map(j => j.position).filter(Boolean))],
    location: [...new Set(jobs.map(j => j.location).filter(Boolean))],
    jobSite: [...new Set(jobs.map(j => j.jobSite).filter(Boolean))],
    url: [...new Set(jobs.map(j => j.url).filter(Boolean))]
  };

  if (isLoading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center h="50vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.500" thickness="4px" />
            <Text color="gray.600">Loading your job applications...</Text>
          </VStack>
        </Center>
      </Container>
    );
  }

  return (
    <Box minH="100vh" bg={mainBg} py={8}>
      <Container maxW="container.xl">
        {/* Header */}
        <Flex mb={8} align="center">
          <VStack align="start" flex={1}>
            <Heading size="2xl" color={headingColor}>
              Job Application Tracker
            </Heading>
            <Text fontSize="lg" color={subtitleColor}>
              Track, manage, and succeed in your job search
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

        {/* Search */}
        <Box mb={6}>
          <InputGroup size="lg">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search jobs by any field..."
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value;
                setSearchInput(value);
                
                // Clear existing timeout
                if (searchTimeout.current) {
                  clearTimeout(searchTimeout.current);
                }
                
                // Set new timeout for debounced search
                searchTimeout.current = setTimeout(() => {
                  setFilter(value);
                }, 200);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchInput('');
                  setFilter('');
                }
              }}
              bg={bgColor}
            />
          </InputGroup>
        </Box>

        {/* Stats */}
        {!filter.trim() && (
          <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4} mb={6}>
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
          </SimpleGrid>
        )}

        {/* Add New Application Button */}
        {!filter.trim() && (
          <Box mb={6}>
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

        {/* Pending Applications */}
        {!filter.trim() && unsavedJobs.length > 0 && (
          <Box bg={bgColor} borderRadius="lg" mb={6} overflow="hidden" border="1px solid" borderColor={borderColor}>
            <Box bg="yellow.50" p={4} borderBottom="2px solid" borderBottomColor="yellow.400">
              <Heading size="md" color="gray.800">Pending Applications</Heading>
              <Text fontSize="sm" color="gray.600" mt={1}>Missing Applied Date</Text>
            </Box>
            <TableContainer>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Company</Th>
                    <Th>Position</Th>
                    <Th>Location</Th>
                    <Th>Status</Th>
                    <Th>Applied Date</Th>
                    <Th>Rejection Date</Th>
                    <Th>Job Site</Th>
                    <Th>URL</Th>
                    <Th>Save Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {unsavedJobs.map((job, index) => (
                    <JobRow 
                      key={job.id || `unsaved-${index}`} 
                      job={job} 
                      jobIndex={jobs.indexOf(job)}
                      updateJobField={updateJobField}
                      savingStatus={savingStatus[jobs.indexOf(job)]}
                      suggestions={suggestions}
                      statusOptions={statusOptions}
                    />
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Filtered Results */}
        {filter.trim() ? (
          <Box bg={bgColor} borderRadius="lg" overflow="hidden" border="1px solid" borderColor={borderColor}>
            <TableContainer>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Company</Th>
                    <Th>Position</Th>
                    <Th>Location</Th>
                    <Th>Status</Th>
                    <Th>Applied Date</Th>
                    <Th>Rejection Date</Th>
                    <Th>Job Site</Th>
                    <Th>URL</Th>
                    <Th>Save Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredJobs.map((job) => {
                    const jobIndex = jobs.indexOf(job);
                    return (
                      <JobRow 
                        key={job.id || `filtered-${jobIndex}`}
                        job={job} 
                        jobIndex={jobIndex}
                        updateJobField={updateJobField}
                        savingStatus={savingStatus[jobIndex]}
                        suggestions={suggestions}
                        statusOptions={statusOptions}
                      />
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          /* Monthly Grouped Jobs */
          <Accordion allowMultiple index={Object.keys(jobsByMonth).map((month, idx) => 
            openMonths.includes(month) ? idx : -1
          ).filter(idx => idx !== -1)}>
            {Object.keys(jobsByMonth).map((month) => {
              const monthJobs = jobsByMonth[month];
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
                    <TableContainer>
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>Company</Th>
                            <Th>Position</Th>
                            <Th>Location</Th>
                            <Th>Status</Th>
                            <Th>Applied Date</Th>
                            <Th>Rejection Date</Th>
                            <Th>Job Site</Th>
                            <Th>URL</Th>
                            <Th></Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {monthJobs.map((job) => {
                            const jobIndex = jobs.indexOf(job);
                            return (
                              <JobRow 
                                key={job.id || `month-${jobIndex}`}
                                job={job} 
                                jobIndex={jobIndex}
                                updateJobField={updateJobField}
                                savingStatus={savingStatus[jobIndex]}
                                suggestions={suggestions}
                                statusOptions={statusOptions}
                              />
                            );
                          })}
                        </Tbody>
                      </Table>
                    </TableContainer>
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