import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Image, Linking, TouchableOpacity, Platform, NativeEventEmitter, NativeModules } from 'react-native';
import { FAB, Card, Chip } from 'react-native-paper'; 
import * as ImagePicker from 'expo-image-picker';
import Swiper from 'react-native-deck-swiper';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const { DeviceEventManagerModule } = NativeModules;
console.log('SQLite', SQLite);  
const db = SQLite.openDatabaseSync('todos');

export default function App() {
  const [loading, setLoading] = React.useState(true);
  const [todos, setTodos] = React.useState([]);
  const [isFirstLoad, setIsFirstLoad] = React.useState(true);
  const [isPermissionGranted, setIsPermissionGranted] = React.useState(true);

  const requestPermissions = async () => {
    const permissionGranted = false;
    if (Platform.OS === 'ios') {
      const result = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      if (result === RESULTS.GRANTED) {
        console.log('Photo library permission granted');
        setIsPermissionGranted(true);
      }
      else {
        alert("Please grant access to photo library to continue. The app reads the screenshots from your photo library.")
      }
    } else if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const imageResult = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        const videoResult = await request(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
        if (imageResult === RESULTS.GRANTED && videoResult === RESULTS.GRANTED) {
          console.log('Media permissions granted');
          setIsPermissionGranted(true);
        }
        else {
          alert("Please grant access to media to continue. The app reads the screenshots from your media.")
        }
      } else {
        const result = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
        if (result === RESULTS.GRANTED) {
          console.log('Storage permission granted');
          setIsPermissionGranted(true);
        }
        else {
          alert("Please grant access to storage to continue. The app reads the screenshots from your storage.")
        }
      }
    }
  };
  
  useEffect(() => {

    requestPermissions();
    
    db.execAsync('CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, image TEXT, status TEXT, timestamp TEXT);').then(() => {
      fetchTodos();
    })
    const eventEmitter = new NativeEventEmitter(DeviceEventManagerModule);
    const subscription = eventEmitter.addListener('ImageShared', (uri) => {
      console.log('Image URI:', uri);
      // Handle the image URI
      addTodo(uri);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const fetchTodos = async () => {
    const todoRows = await db.getAllAsync('SELECT * FROM todos WHERE status = "pending" ORDER BY timestamp;');
    console.log('todoRows', todoRows);
    setTodos(todoRows);
    const isFirstLoad = await AsyncStorage.getItem('isFirstLoad');
    if(isFirstLoad != "false") {
      setIsFirstLoad(true);
    }

    setLoading(false);
  };

  const addTodoFromCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.cancelled) {
      addTodo(result.assets[0].uri);
    }
  }

  const addTodo = async (imageUri) => {
    const timestamp = new Date().toISOString();
    await db.runAsync('INSERT INTO todos (image, status, timestamp) VALUES (?, ?, ?);', [imageUri, 'pending', timestamp]);
    console.log('Added todo', imageUri);
    fetchTodos();
  }

  const handleSwipe = async (cardIndex, direction) => {
    console.log('cardIndex', cardIndex, todos.length);
    if(direction === 'right') {
      await db.runAsync('UPDATE todos SET status = "done" WHERE id = ?;', [todos[cardIndex].id]);
      AsyncStorage.setItem('isFirstLoad', 'false');
      setIsFirstLoad(false);
    } 

    if(cardIndex >= todos.length - 1){
      console.log("refreshing");
      fetchTodos();
      return;
    }
  }


  function timeAgo(timestamp) {
    const now = new Date();
    const timeDiff = now - new Date(timestamp);
    const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));

    if(hoursDiff < 1)
      return "Just now";
    if (hoursDiff < 24) {
      return hoursDiff + " hours ago";
    } else {
      const daysDiff = Math.floor(hoursDiff / 24);
      if(daysDiff === 1)
        return "Yesterday";
      else
        return daysDiff + " days ago";
    }
  }
  const openImage = (uri) => {
    Linking.openURL(uri);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {
        !isPermissionGranted?<View style={styles.loadingContainer}>
          <ActivityIndicator />
          <Text> Waiting for access to media storage </Text>
        </View>: null

      }
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      ) : todos.length > 0 ? (
        <Swiper backgroundColor='#fff'
          infinite={true}
          cards={todos}
          renderCard={(todo) => (
            <TouchableOpacity onPress={() => openImage(todo.image)} >
              <Card style={{ height: '100%' }}>
                <Card.Cover source={{ uri: todo.image }} fadeDuration={0} resizeMode='contain' style={{ height: '95%'}} />
                <Card.Content>
                  <Text style={{marginTop: 4}}>{timeAgo(todo.timestamp)}</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          )}
          keyExtractor={(todo) => todo.id.toString()}
          onSwipedRight={(cardIndex) => handleSwipe(cardIndex, 'right')}
          onSwipedLeft={(cardIndex) => handleSwipe(cardIndex, 'left')}
        />
      ): isFirstLoad?(
        <View style={styles.doneContainer}>
          <Text style={{fontSize: 32}}>Welcome to Todo Screenshots!</Text>
          <Text>To add new todos, take a screenshot and tap on share. On the sharesheet, select "Todo Screenshots"</Text>
          <Text>Once added, swipe left to mark for later, swipe right to mark as done</Text>          
        </View>

        ): (
        <View style={styles.doneContainer}>
          <Text style={{fontSize: 32}}>All done!</Text>
        </View>
      )
    }


      <FAB
        style={styles.fab}
        icon="plus"
        onPress={addTodoFromCamera} // Replace with your desired functionality
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 32
  },
});
