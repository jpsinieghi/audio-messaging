import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, FlatList } from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { audioAPI } from '../services/api';

export default function ModeratorDashboard({ onLogout, navigation }) {
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [recording, setRecording] = useState();
  const [isRecording, setIsRecording] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    loadUsername();
    loadMessages();
  }, []);

  const loadUsername = async () => {
    const user = await AsyncStorage.getItem('username');
    setUsername(user);
  };

  const loadMessages = async () => {
    try {
      const response = await audioAPI.getMessages();
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const playAudio = async (filename) => {
    try {
      const { sound } = await Audio.Sound.createAsync({
        uri: `http://192.168.1.4:3000/uploads/${filename}`,
      });
      await sound.playAsync();
    } catch (error) {
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const startRecording = async () => {
    if (!selectedMessage) {
      Alert.alert('Error', 'Please select a message to respond to');
      return;
    }

    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setRecording(undefined);
    await recording.stopAndUnloadAsync();
    
    const uri = recording.getURI();
    sendResponse(uri);
  };

  const sendResponse = async (uri) => {
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'response.m4a',
      });

      await audioAPI.respondToMessage(selectedMessage.id, formData);
      Alert.alert('Success', 'Response sent!');
      setSelectedMessage(null);
      loadMessages();
    } catch (error) {
      Alert.alert('Error', 'Failed to send response');
    }
  };

  const logout = async () => {
    await AsyncStorage.clear();
    onLogout();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🎵</Text>
        <Text style={styles.title}>Moderator: {username}</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Incoming Messages</Text>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.messageItem,
                item.responded && styles.respondedMessage
              ]}
              onPress={() => navigation.navigate('ResponseScreen', { message: item })}
            >
              <Text style={styles.messageUser}>From: {item.username}</Text>
              <Text style={styles.messageTime}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => playAudio(item.filename)}
              >
                <Text>▶️ Play Message</Text>
              </TouchableOpacity>
              {item.responded && (
                <Text style={styles.respondedText}>✅ Responded</Text>
              )}
            </TouchableOpacity>
          )}
        />
      </View>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logo: {
    fontSize: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  messageItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedMessage: {
    borderColor: '#007AFF',
  },
  respondedMessage: {
    opacity: 0.7,
  },
  messageUser: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  playButton: {
    backgroundColor: '#34C759',
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
  },
  respondedText: {
    marginTop: 5,
    color: '#34C759',
    fontWeight: 'bold',
  },
  responseSection: {
    backgroundColor: 'white',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  responseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  recordButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  recordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});