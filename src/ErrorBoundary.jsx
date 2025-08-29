import React from 'react';
import { Box, Text, VStack, Card, CardHeader, CardBody, Heading } from '@chakra-ui/react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box minH="100vh" p={6} bg="gray.50">
          <VStack spacing={4} maxW="container.md" mx="auto" mt={10}>
            <Card borderColor="red.300" borderWidth="2px" w="full">
              <CardHeader>
                <Heading size="lg" color="red.600">⚠️ Application Error</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="start">
                  <Text>Something went wrong while loading the application.</Text>
                  <Box as="pre" p={4} bg="red.50" borderRadius="md" fontSize="sm" overflowX="auto">
                    {this.state.error && this.state.error.toString()}
                  </Box>
                  <Text fontSize="sm" color="gray.600">
                    Please check the browser console for more details.
                  </Text>
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;