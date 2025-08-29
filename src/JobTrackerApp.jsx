import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  VStack,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Collapse,
  Badge,
  IconButton,
  useColorMode,
  useColorModeValue,
  Flex,
  Text,
  InputGroup,
  InputLeftElement,
  Card,
  CardHeader,
  CardBody,
  Spinner,
  Center,
  useToast,
  Tooltip,
} from "@chakra-ui/react";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
} from "lucide-react";

// JobRow component defined outside to prevent recreation on every render
const JobRow = ({ job, jobIndex, updateJobField, savingStatus, suggestions, statusOptions }) => {
  const inputBg = useColorModeValue("white", "gray.700");
  const borderColor = useColorModeValue("gray.300", "gray.600");
  
  const getStatusColor = (status) => {
    const statusColors = {
      "Applied": "blue",
      "Assessment": "purple",
      "Interviewing": "green",
      "Rejected": "red",
      "Screening": "orange",
    };
    return statusColors[status] || "gray";
  };

  return (
    <Tr>
      {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map(key => (
        <Td key={key}>
          {key === "status" ? (
            <Select
              value={job[key] || ""}
              onChange={(e) => updateJobField(job.id, jobIndex, key, e.target.value)}
              bg={inputBg}
              borderColor={borderColor}
              size="sm"
            >
              <option value="">Select</option>
              {statusOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          ) : key.includes("Date") ? (
            <Input
              type="date"
              value={job[key] || ""}
              onChange={(e) => updateJobField(job.id, jobIndex, key, e.target.value)}
              bg={inputBg}
              borderColor={borderColor}
              size="sm"
            />
          ) : (
            <>
              <Input
                list={`list-${key}-${jobIndex}`}
                type="text"
                value={job[key] || ""}
                onChange={(e) => updateJobField(job.id, jobIndex, key, e.target.value)}
                bg={inputBg}
                borderColor={borderColor}
                size="sm"
                placeholder={`Enter ${key}`}
                autoComplete="off"
              />
              <datalist id={`list-${key}-${jobIndex}`}>
                {(suggestions[key] || []).map((suggestion, idx) => (
                  <option key={idx} value={suggestion} />
                ))}
              </datalist>
            </>
          )}
        </Td>
      ))}
      <Td>
        {savingStatus && (
          <Badge colorScheme={savingStatus.includes("Error") ? "red" : savingStatus.includes("✅") ? "green" : "yellow"} fontSize="xs">
            {savingStatus}
          </Badge>
        )}
      </Td>
    </Tr>
  );
};

export default function JobTrackerApp() {
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();
  
  // Color mode values
  const bgGradient = useColorModeValue(
    "linear(to-tr, gray.50, gray.100)",
    "linear(to-tr, gray.900, gray.800)"
  );
  const cardBg = useColorModeValue("white", "gray.800");
  const headerBg = useColorModeValue("gray.100", "gray.700");
  const headingColor = useColorModeValue("gray.800", "white");
  const statBg = useColorModeValue("white", "gray.700");
  const inputBg = useColorModeValue("white", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  
  const statusOptions = [
    "Applied",
    "Assessment",
    "Interviewing",
    "Rejected",
    "Screening",
  ];

  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState("");
  const [openMonths, setOpenMonths] = useState([]);
  const [savingStatus, setSavingStatus] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeouts = useRef({});

  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("appliedDate", { ascending: false });

      if (error) {
        console.error("Error fetching jobs:", error);
        toast({
          title: "Error fetching jobs",
          description: error.message,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } else {
        setJobs(data || []);
      }
      setIsLoading(false);
    };

    fetchJobs();
  }, [toast]);

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
            toast({
              title: "Error updating job",
              description: error.message,
              status: "error",
              duration: 3000,
              isClosable: true,
            });
          } else {
            setSavingStatus(prev => ({ ...prev, [jobIndex]: "Saved ✅" }));
          }
        } else {
          const { id, ...jobWithoutId } = sanitizedJob;
          const { data, error } = await supabase
            .from("jobs")
            .insert([jobWithoutId])
            .select();

          if (error || !data) {
            console.error("Error inserting job:", error?.message || "No data returned");
            setSavingStatus(prev => ({ ...prev, [jobIndex]: "Error!" }));
            toast({
              title: "Error inserting job",
              description: error?.message || "No data returned",
              status: "error",
              duration: 3000,
              isClosable: true,
            });
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
      status: "",
      appliedDate: today,
      rejectionDate: null,
      jobSite: "",
      url: "",
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("jobs").insert([newJob]).select();

    if (error || !data) {
      console.error("Error inserting job:", error?.message || "No data returned");
      toast({
        title: "Error adding job",
        description: error?.message || "No data returned",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      setJobs(prev => [data[0], ...prev]);
      toast({
        title: "Job added",
        description: "New job entry created successfully",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
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
    const date = new Date(dateStr);
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
      <Box minH="100vh" bgGradient={bgGradient} p={6}>
        <Center h="100vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.500" thickness="4px" />
            <Text fontSize="xl" color={headingColor}>Loading jobs...</Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bgGradient={bgGradient} p={6}>
      <Container maxW="container.xl">
        <VStack spacing={8}>
          {/* Header with Dark Mode Toggle */}
          <Flex w="full" justify="space-between" align="center">
            <Heading size="2xl" color={headingColor}>
              📋 Job Application Tracker
            </Heading>
            <Tooltip label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}>
              <IconButton
                aria-label="Toggle color mode"
                icon={colorMode === "light" ? <Moon /> : <Sun />}
                onClick={toggleColorMode}
                colorScheme="brand"
                variant="ghost"
                size="lg"
              />
            </Tooltip>
          </Flex>

          {/* Search Bar */}
          <InputGroup size="lg">
            <InputLeftElement pointerEvents="none">
              <Search color="gray" size={20} />
            </InputLeftElement>
            <Input
              placeholder="Search jobs by any field (company, position, location, status, job site, URL, dates)..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setFilter('');
                }
              }}
              bg={inputBg}
              borderColor={borderColor}
              _placeholder={{ color: useColorModeValue("gray.500", "gray.400") }}
            />
          </InputGroup>

          {/* Stats Dashboard */}
          {!filter.trim() && (
            <Card w="full" bg={cardBg} borderColor={borderColor} variant="outline">
              <CardBody>
                <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4}>
                  <Stat bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <StatLabel fontSize="sm">📌 Applied</StatLabel>
                    <StatNumber fontSize="lg">{stats.Applied}</StatNumber>
                    <StatHelpText fontSize="xs">
                      {stats.Total > 0 ? ((stats.Applied / stats.Total) * 100).toFixed(1) : 0}%
                    </StatHelpText>
                  </Stat>
                  <Stat bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <StatLabel fontSize="sm">📞 Interviewing</StatLabel>
                    <StatNumber fontSize="lg">{stats.Interviewing}</StatNumber>
                    <StatHelpText fontSize="xs">
                      {stats.Total > 0 ? ((stats.Interviewing / stats.Total) * 100).toFixed(1) : 0}%
                    </StatHelpText>
                  </Stat>
                  <Stat bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <StatLabel fontSize="sm">❌ Rejected</StatLabel>
                    <StatNumber fontSize="lg">{stats.Rejected}</StatNumber>
                    <StatHelpText fontSize="xs">
                      {stats.Total > 0 ? ((stats.Rejected / stats.Total) * 100).toFixed(1) : 0}%
                    </StatHelpText>
                  </Stat>
                  <Stat bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <StatLabel fontSize="sm">🧪 Assessment</StatLabel>
                    <StatNumber fontSize="lg">{stats.Assessment}</StatNumber>
                    <StatHelpText fontSize="xs">
                      {stats.Total > 0 ? ((stats.Assessment / stats.Total) * 100).toFixed(1) : 0}%
                    </StatHelpText>
                  </Stat>
                  <Stat bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <StatLabel fontSize="sm">🔍 Screening</StatLabel>
                    <StatNumber fontSize="lg">{stats.Screening}</StatNumber>
                    <StatHelpText fontSize="xs">
                      {stats.Total > 0 ? ((stats.Screening / stats.Total) * 100).toFixed(1) : 0}%
                    </StatHelpText>
                  </Stat>
                  <Stat bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <StatLabel fontSize="sm">🗂️ Total</StatLabel>
                    <StatNumber fontSize="lg">{stats.Total}</StatNumber>
                    <StatHelpText fontSize="xs">All jobs</StatHelpText>
                  </Stat>
                </SimpleGrid>
              </CardBody>
            </Card>
          )}

          {/* Add Row Button */}
          {!filter.trim() && (
            <Button
              leftIcon={<Plus />}
              colorScheme="brand"
              size="lg"
              onClick={addRow}
            >
              Add Row
            </Button>
          )}

          {/* Unsaved Jobs Section */}
          {!filter.trim() && unsavedJobs.length > 0 && (
            <Card w="full" bg={cardBg} borderColor={borderColor} variant="outline">
              <CardHeader bg="yellow.100" _dark={{ bg: "yellow.900" }}>
                <Heading size="md">📌 Unsaved Jobs (No Applied Date)</Heading>
              </CardHeader>
              <CardBody p={0}>
                <TableContainer>
                  <Table variant="simple" size="sm">
                    <Thead bg={headerBg}>
                      <Tr>
                        {["Company", "Position", "Location", "Status", "Applied Date", "Rejection Date", "Job Site", "URL", ""].map(header => (
                          <Th key={header}>{header}</Th>
                        ))}
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
              </CardBody>
            </Card>
          )}

          {/* Filtered Jobs Table */}
          {filter.trim() ? (
            <Card w="full" bg={cardBg} borderColor={borderColor} variant="outline">
              <CardBody p={0}>
                <TableContainer>
                  <Table variant="simple" size="sm">
                    <Thead bg={headerBg}>
                      <Tr>
                        {["Company", "Position", "Location", "Status", "Applied Date", "Rejection Date", "Job Site", "URL", ""].map(header => (
                          <Th key={header}>{header}</Th>
                        ))}
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
              </CardBody>
            </Card>
          ) : (
            // Monthly Job Groups
            Object.keys(jobsByMonth).map(month => {
              const monthJobs = jobsByMonth[month];
              const isOpen = openMonths.includes(month);
              const monthStats = {
                Applied: monthJobs.filter(j => j.status === "Applied").length,
                Interviewing: monthJobs.filter(j => j.status === "Interviewing").length,
                Rejected: monthJobs.filter(j => j.status === "Rejected").length,
                Assessment: monthJobs.filter(j => j.status === "Assessment").length,
                Screening: monthJobs.filter(j => j.status === "Screening").length,
              };

              return (
                <Card key={month} w="full" bg={cardBg} borderColor={borderColor} variant="outline">
                  <CardHeader
                    bg={headerBg}
                    cursor="pointer"
                    onClick={() => toggleMonth(month)}
                    _hover={{ bg: useColorModeValue("gray.200", "gray.600") }}
                  >
                    <Flex justify="space-between" align="center" wrap="wrap">
                      <HStack>
                        <Heading size="md">{month}</Heading>
                        {isOpen ? <ChevronUp /> : <ChevronDown />}
                      </HStack>
                      <HStack spacing={3} flexWrap="wrap">
                        <Badge colorScheme="blue">📌 Applied: {monthStats.Applied}</Badge>
                        <Badge colorScheme="green">📞 Interviewing: {monthStats.Interviewing}</Badge>
                        <Badge colorScheme="red">❌ Rejected: {monthStats.Rejected}</Badge>
                        <Badge colorScheme="purple">🧪 Assessment: {monthStats.Assessment}</Badge>
                        <Badge colorScheme="orange">🔍 Screening: {monthStats.Screening}</Badge>
                      </HStack>
                    </Flex>
                  </CardHeader>
                  <Collapse in={isOpen} animateOpacity>
                    <CardBody p={0}>
                      <TableContainer>
                        <Table variant="simple" size="sm">
                          <Thead bg={headerBg}>
                            <Tr>
                              {["Company", "Position", "Location", "Status", "Applied Date", "Rejection Date", "Job Site", "URL", ""].map(header => (
                                <Th key={header}>{header}</Th>
                              ))}
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
                    </CardBody>
                  </Collapse>
                </Card>
              );
            })
          )}
        </VStack>
      </Container>
    </Box>
  );
}