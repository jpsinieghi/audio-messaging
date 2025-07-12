import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import UserDashboard from './src/screens/UserDashboard';
import ModeratorDashboard from './src/screens/ModeratorDashboard';
import ResponseScreen from './src/screens/ResponseScreen';

const Stack = createStackNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const role = await AsyncStorage.getItem('userRole');
      if (token && role) {
        setIsAuthenticated(true);
        setUserRole(role);
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login">
            {props => <LoginScreen {...props} onLogin={checkAuthStatus} />}
          </Stack.Screen>
        ) : userRole === 'user' ? (
          <Stack.Screen name="UserDashboard">
            {props => <UserDashboard {...props} onLogout={checkAuthStatus} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="ModeratorDashboard">
              {props => <ModeratorDashboard {...props} onLogout={checkAuthStatus} />}
            </Stack.Screen>
            <Stack.Screen name="ResponseScreen" component={require('./src/screens/ResponseScreen').default} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}