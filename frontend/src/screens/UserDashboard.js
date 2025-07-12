import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, FlatList } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { audioAPI } from '../services/api';

export default function UserDashboard({ onLogout }) {
  const [recording, setRecording] = useState();
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState('');

  useEffect(() => {
    loadUsername();
    loadMessages();
    
    // Refresh messages every 5 seconds
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadUsername = async () => {
    const user = await AsyncStorage.getItem('username');
    setUsername(user);
  };

  const loadMessages = async () => {
    try {
      console.log('Loading messages...');
      const response = await audioAPI.getMessages();
      console.log('Messages loaded:', response.data);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });
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
    sendAudio(uri);
  };

  const sendAudio = async (uri) => {
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      });

      await audioAPI.sendAudio(formData);
      Alert.alert('Success', 'Audio message sent!');
      loadMessages();
    } catch (error) {
      Alert.alert('Error', 'Failed to send audio');
    }
  };

  const playAudio = async (filename) => {
    try {
      console.log('Playing audio:', filename);
      
      // Get signed URL from backend
      const response = await audioAPI.getAudioUrl(filename);
      const audioUrl = response.data.url;
      console.log('Audio URL:', audioUrl);
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Audio playback error:', error);
      Alert.alert('Error', `Failed to play audio: ${error.message}`);
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
        <Text style={styles.title}>Welcome, {username}</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recordSection}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordingButton]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? '🔴 Stop Recording' : '🎤 Record Message'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Max 30 seconds</Text>
      </View>

      <View style={styles.messagesSection}>
        <Text style={styles.sectionTitle}>Your Messages</Text>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.messageItem}>
              <Text style={styles.messageTime}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
              {item.filename && (
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => playAudio(item.filename)}
                >
                  <Text>▶️ Play Your Message</Text>
                </TouchableOpacity>
              )}
              {!item.filename && item.responded && (
                <Text style={styles.messageDeleted}>Message processed by moderator</Text>
              )}
              {item.responded && (
                <View>
                  {item.response_filename && (
                    <TouchableOpacity
                      style={styles.responseButton}
                      onPress={() => playAudio(item.response_filename)}
                    >
                      <Text>🎧 Play Audio Response</Text>
                    </TouchableOpacity>
                  )}
                  {item.text_response && (
                    <View style={styles.textResponseContainer}>
                      <Text style={styles.textResponseLabel}>Text Response:</Text>
                      <Text style={styles.textResponse}>{item.text_response}</Text>
                    </View>
                  )}
                </View>
              )}
              {!item.responded && (
                <Text style={styles.pending}>⏳ Waiting for response</Text>
              )}
            </View>
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
  recordSection: {
    padding: 20,
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 50,
    minWidth: 200,
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
  hint: {
    marginTop: 10,
    color: '#666',
  },
  messagesSection: {
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
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  playButton: {
    backgroundColor: '#34C759',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 5,
  },
  responseButton: {
    backgroundColor: '#FF9500',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  pending: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  textResponseContainer: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  textResponseLabel: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  textResponse: {
    color: '#666',
  },
  messageDeleted: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 10,
  },
});