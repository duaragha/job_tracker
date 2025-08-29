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
  VStack,
  HStack,
  Stat,
  SimpleGrid,
  Collapsible,
  Badge,
  IconButton,
  Flex,
  Text,
  InputGroup,
  Card,
  CardHeader,
  CardBody,
  Spinner,
  Center,
  Tooltip,
} from "@chakra-ui/react";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// JobRow component defined outside to prevent recreation on every render
const JobRow = ({ job, jobIndex, updateJobField, savingStatus, suggestions, statusOptions }) => {
  const inputBg = "white";
  const borderColor = "gray.300";
  
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
    <Table.Row>
      {["company", "position", "location", "status", "appliedDate", "rejectionDate", "jobSite", "url"].map(key => (
        <Table.Cell key={key}>
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
        </Table.Cell>
      ))}
      <Table.Cell>
        {savingStatus && (
          <Badge colorScheme={savingStatus.includes("Error") ? "red" : savingStatus.includes("✅") ? "green" : "yellow"} fontSize="xs">
            {savingStatus}
          </Badge>
        )}
      </Table.Cell>
    </Table.Row>
  );
};

export default function JobTrackerApp() {
  
  // Color values
  const bgGradient = "linear(to-tr, gray.50, gray.100)";
  const cardBg = "white";
  const headerBg = "gray.100";
  const headingColor = "gray.800";
  const statBg = "white";
  const inputBg = "white";
  const borderColor = "gray.200";
  
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
  const [error, setError] = useState(null);
  const saveTimeouts = useRef({});

  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      setError(null);

      // Check if Supabase client is properly initialized
      if (!supabase) {
        setError("Database connection not configured. Please set environment variables in Vercel.");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .order("appliedDate", { ascending: false });

        if (error) {
          console.error("Error fetching jobs:", error);
          setError(`Failed to load jobs: ${error.message}`);
        } else {
          setJobs(data || []);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred while loading jobs");
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

        if (!supabase) {
          console.error("Cannot save: Supabase not initialized");
          setSavingStatus(prev => ({ ...prev, [jobIndex]: "No DB connection!" }));
        } else if (jobId) {
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
          const { id, ...jobWithoutId } = sanitizedJob;
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
    if (!supabase) {
      console.error("Cannot add row: Supabase not initialized");
      return;
    }

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

  if (error) {
    return (
      <Box minH="100vh" bgGradient={bgGradient} p={6}>
        <Center h="100vh">
          <VStack spacing={4}>
            <Card maxW="md" bg={cardBg} borderColor="red.300" borderWidth="2px">
              <CardHeader>
                <Heading size="lg" color="red.600">⚠️ Connection Error</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="start">
                  <Text color={headingColor}>{error}</Text>
                  <Text fontSize="sm" color="gray.600">
                    To fix this issue in Vercel:
                  </Text>
                  <Box as="ol" pl={5} fontSize="sm" color="gray.600">
                    <li>Go to your Vercel project dashboard</li>
                    <li>Navigate to Settings → Environment Variables</li>
                    <li>Add the following variables:</li>
                    <Box as="ul" pl={5} mt={2}>
                      <li><code>VITE_SUPABASE_URL</code></li>
                      <li><code>VITE_SUPABASE_ANON_KEY</code></li>
                    </Box>
                    <li>Redeploy your application</li>
                  </Box>
                  <Text fontSize="xs" color="gray.500" mt={4}>
                    Check the browser console for more details.
                  </Text>
                </VStack>
              </CardBody>
            </Card>
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
          </Flex>

          {/* Search Bar */}
          <InputGroup size="lg" startElement={<Search color="gray" size={20} />}>
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
              _placeholder={{ color: "gray.500" }}
            />
          </InputGroup>

          {/* Stats Dashboard */}
          {!filter.trim() && (
            <Card w="full" bg={cardBg} borderColor={borderColor} variant="outline">
              <CardBody>
                <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4}>
                  <Stat.Root bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <Stat.Label fontSize="sm">📌 Applied</Stat.Label>
                    <Stat.ValueText fontSize="lg">{stats.Applied}</Stat.ValueText>
                    <Stat.HelpText fontSize="xs">
                      {stats.Total > 0 ? ((stats.Applied / stats.Total) * 100).toFixed(1) : 0}%
                    </Stat.HelpText>
                  </Stat.Root>
                  <Stat.Root bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <Stat.Label fontSize="sm">📞 Interviewing</Stat.Label>
                    <Stat.ValueText fontSize="lg">{stats.Interviewing}</Stat.ValueText>
                    <Stat.HelpText fontSize="xs">
                      {stats.Total > 0 ? ((stats.Interviewing / stats.Total) * 100).toFixed(1) : 0}%
                    </Stat.HelpText>
                  </Stat.Root>
                  <Stat.Root bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <Stat.Label fontSize="sm">❌ Rejected</Stat.Label>
                    <Stat.ValueText fontSize="lg">{stats.Rejected}</Stat.ValueText>
                    <Stat.HelpText fontSize="xs">
                      {stats.Total > 0 ? ((stats.Rejected / stats.Total) * 100).toFixed(1) : 0}%
                    </Stat.HelpText>
                  </Stat.Root>
                  <Stat.Root bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <Stat.Label fontSize="sm">🧪 Assessment</Stat.Label>
                    <Stat.ValueText fontSize="lg">{stats.Assessment}</Stat.ValueText>
                    <Stat.HelpText fontSize="xs">
                      {stats.Total > 0 ? ((stats.Assessment / stats.Total) * 100).toFixed(1) : 0}%
                    </Stat.HelpText>
                  </Stat.Root>
                  <Stat.Root bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <Stat.Label fontSize="sm">🔍 Screening</Stat.Label>
                    <Stat.ValueText fontSize="lg">{stats.Screening}</Stat.ValueText>
                    <Stat.HelpText fontSize="xs">
                      {stats.Total > 0 ? ((stats.Screening / stats.Total) * 100).toFixed(1) : 0}%
                    </Stat.HelpText>
                  </Stat.Root>
                  <Stat.Root bg={statBg} p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                    <Stat.Label fontSize="sm">🗂️ Total</Stat.Label>
                    <Stat.ValueText fontSize="lg">{stats.Total}</Stat.ValueText>
                    <Stat.HelpText fontSize="xs">All jobs</Stat.HelpText>
                  </Stat.Root>
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
                <Box overflowX="auto">
                  <Table.Root variant="simple" size="sm">
                    <Table.Header bg={headerBg}>
                      <Table.Row>
                        {["Company", "Position", "Location", "Status", "Applied Date", "Rejection Date", "Job Site", "URL", ""].map(header => (
                          <Table.ColumnHeader key={header}>{header}</Table.ColumnHeader>
                        ))}
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
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
                    </Table.Body>
                  </Table.Root>
                </Box>
              </CardBody>
            </Card>
          )}

          {/* Filtered Jobs Table */}
          {filter.trim() ? (
            <Card w="full" bg={cardBg} borderColor={borderColor} variant="outline">
              <CardBody p={0}>
                <Box overflowX="auto">
                  <Table.Root variant="simple" size="sm">
                    <Table.Header bg={headerBg}>
                      <Table.Row>
                        {["Company", "Position", "Location", "Status", "Applied Date", "Rejection Date", "Job Site", "URL", ""].map(header => (
                          <Table.ColumnHeader key={header}>{header}</Table.ColumnHeader>
                        ))}
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
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
                    </Table.Body>
                  </Table.Root>
                </Box>
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
                    _hover={{ bg: "gray.200" }}
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
                  <Collapsible.Root open={isOpen}>
                    <Collapsible.Content>
                      <CardBody p={0}>
                        <Box overflowX="auto">
                          <Table.Root variant="simple" size="sm">
                            <Table.Header bg={headerBg}>
                              <Table.Row>
                                {["Company", "Position", "Location", "Status", "Applied Date", "Rejection Date", "Job Site", "URL", ""].map(header => (
                                  <Table.ColumnHeader key={header}>{header}</Table.ColumnHeader>
                                ))}
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
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
                            </Table.Body>
                          </Table.Root>
                        </Box>
                      </CardBody>
                    </Collapsible.Content>
                  </Collapsible.Root>
                </Card>
              );
            })
          )}
        </VStack>
      </Container>
    </Box>
  );
}