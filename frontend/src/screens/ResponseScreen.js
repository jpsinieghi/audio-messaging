import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { audioAPI } from '../services/api';

export default function ResponseScreen({ route, navigation }) {
  const { message } = route.params;
  const [textResponse, setTextResponse] = useState('');
  const [recording, setRecording] = useState();
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  const playAudio = async () => {
    if (!message.filename) {
      Alert.alert('Info', 'Audio file no longer available');
      return;
    }
    
    try {
      // Get signed URL from backend
      const response = await audioAPI.getAudioUrl(message.filename);
      const audioUrl = response.data.url;
      
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
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const sendTextResponse = async () => {
    if (!textResponse.trim()) {
      Alert.alert('Error', 'Please enter a text response');
      return;
    }

    setLoading(true);
    try {
      console.log('Sending text response:', { messageId: message.id, textResponse });
      await audioAPI.respondWithText(message.id, textResponse);
      Alert.alert('Success', 'Text response sent!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Text response error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.error || 'Failed to send text response';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
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
    sendAudioResponse(uri);
  };

  const sendAudioResponse = async (uri) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'response.m4a',
      });

      await audioAPI.respondToMessage(message.id, formData);
      Alert.alert('Success', 'Audio response sent!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to send audio response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Respond to {message.username}</Text>
      </View>

      <View style={styles.messageSection}>
        <Text style={styles.messageTime}>
          {new Date(message.timestamp).toLocaleString()}
        </Text>
        {message.filename ? (
          <TouchableOpacity style={styles.playButton} onPress={playAudio}>
            <Text style={styles.playButtonText}>▶️ Play Message</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.noAudioText}>Audio no longer available</Text>
        )}
      </View>

      <View style={styles.responseSection}>
        <Text style={styles.sectionTitle}>Text Response</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Type your response here..."
          value={textResponse}
          onChangeText={setTextResponse}
          multiline
          numberOfLines={4}
        />
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.buttonDisabled]}
          onPress={sendTextResponse}
          disabled={loading}
        >
          <Text style={styles.sendButtonText}>Send Text Response</Text>
        </TouchableOpacity>

        <Text style={styles.orText}>OR</Text>

        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordingButton]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={loading}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? '🔴 Stop Recording' : '🎤 Record Audio Response'}
          </Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    color: '#007AFF',
    fontSize: 16,
    marginRight: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  messageSection: {
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  playButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  playButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  responseSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    backgroundColor: 'white',
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  recordButton: {
    backgroundColor: '#FF9500',
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
  buttonDisabled: {
    opacity: 0.6,
  },
  noAudioText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 15,
  },
});