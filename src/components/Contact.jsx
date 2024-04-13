import React from 'react'
import './Contact.css'
import '../App.css'
import './RightP.css'
import { initializeApp } from "firebase/app";
import { getDatabase, push, ref } from "firebase/database";
// import {firebase} from "firebase";
import { useState } from 'react';

function Contact() {

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');

const firebaseConfig = {
  apiKey: "AIzaSyBtv_10zH0T1leJSyYlm4B7G3OPTeJTBG4",
  authDomain: "fahad-portfolio9lag.firebaseapp.com",
  projectId: "fahad-portfolio9lag",
  storageBucket: "fahad-portfolio9lag.appspot.com",
  messagingSenderId: "343666410904",
  appId: "1:343666410904:web:4bc826873a7babfcbfd7ed",
  databaseURL: "https://fahad-portfolio9lag-default-rtdb.asia-southeast1.firebasedatabase.app/",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);


const handleSubmit = () => {

    const toPush = {
        "name": name,
        "email": email,
        "msg": msg,
    }

    push(ref(database, 'contacts/' + name), toPush);

    setName('');
    setEmail('');
    setMsg('');

    alert('Message sent!');
}


  return (
    <div className='Contact About'>
      <h2 className='AboutMe'>GET IN TOUCH!</h2>
    <div className="form">
      <input className='smallInput' placeholder='Name' onChange={e => setName(e.target.value)} value={name}/>
      <input type="email" className='smallInput' placeholder='Email' onChange={e => setEmail(e.target.value)} value={email}/>
      <input className='msgInput' placeholder='Message' onChange={e => setMsg(e.target.value)} value={msg}/>
      <button  className='navButton' onClick={handleSubmit}>Submit</button>
    </div>
    </div>
  )
}

export default Contact
