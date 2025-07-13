import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async () => {
    if (isRegister) {
      if (!name || !email || !password || !confirmPassword) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
    } else {
      if (!email || !password) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
    }

    setLoading(true);
    try {
      let response;
      if (isRegister) {
        console.log('Attempting registration with:', { name, email });
        response = await authAPI.register({ name, email, password });
        console.log('Registration response:', response.data);
      } else {
        console.log('Attempting login with:', { email });
        response = await authAPI.login({ username: email, password });
        console.log('Login response:', response.data);
      }
      
      const { token, role, name } = response.data;
      
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('userRole', role);
      await AsyncStorage.setItem('username', email);
      if (name) await AsyncStorage.setItem('userName', name);
      
      onLogin();
    } catch (error) {
      console.error('Auth error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.error || 'Connection failed. Make sure backend is running.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/cn1.png')} style={styles.logoImage} />
      <Text style={styles.logo}>🙏 Pedido de Oração</Text>
      <Text style={styles.title}>{isRegister ? 'Register' : 'Login'}</Text>
      
      {isRegister && (
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      )}
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      {isRegister && (
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
      )}
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? (isRegister ? 'Registering...' : 'Logging in...') : (isRegister ? 'Register' : 'Login')}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.switchButton}
        onPress={() => setIsRegister(!isRegister)}
      >
        <Text style={styles.switchButtonText}>
          {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
        </Text>
      </TouchableOpacity>
      
      <Text style={styles.hint}>
        Demo accounts:{'\n'}
        User: user1 / user123{'\n'}
        Moderator: admin / admin123
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  logoImage: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 20,
    resizeMode: 'contain',
  },
  logo: {
    fontSize: 30,
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: 'white',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hint: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
    fontSize: 12,
  },
  switchButton: {
    marginTop: 15,
    padding: 10,
  },
  switchButtonText: {
    textAlign: 'center',
    color: '#007AFF',
    fontSize: 14,
  },
});