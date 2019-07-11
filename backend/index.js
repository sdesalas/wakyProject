const express = require('express');
const server = express();
const Veterinary = require('./model/Veterinary');
const User = require('./model/User');
const path = require('path');
const bodyParser = require('body-parser');
const sha1 = require('sha1');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config();
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;

const port = process.env.PORT || 3001;
const salt = '=DPr4D2gHVP^39s#vkU=';  /*posibilidad de pasarlo a la conf de heroku y al .env */ 
const secret = 'As#zB+U=22&FIaIm';

//---------------------------------------- SETTINGS -----------------------------------------

server.set("port", port);

server.use("/", express.static(path.join(__dirname, "../build")));
server.use("/veterinaria", express.static(path.join(__dirname, "../build")));

server.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  ); next();
});
server.use(passport.initialize());
server.use(bodyParser.json());
server.use(cookieParser(secret));

passport.use(new JwtStrategy({
  jwtFromRequest: (req) => req.cookies && req.cookies.jwt, 
  secretOrKey: secret
  }, 
  (payload, done)=> {
  console.log('received cookie info', payload)
  return done(null, payload.user)
}))

passport.use(new LocalStrategy({usernameField: 'email'},
  function (username, password, done) {
    console.log('Logging in...', {username, password
    })

    const userHash = sha1(password + salt);
    console.log("Preguntando a mongodb");

    User.find({
      username,
      userHash
    }, (err, result) => {
      console.log("Terminado con mongodb");
      if (err) console.log(err);
      const user = result[0];
      done(err, user && user.objectId);
    });
  }
));



// -----------------------------------------  API  ---------------------------------------------------


/// ROUTE 00: /api                devuelve "Lista de APIs"

server.get("/api", (req, res) => {
  res.write("/api/veterinary                List of veterinaries\n");
  res.write("/api/veterinary/:objectId      Detail for veterinary\n");
  res.write('/api/user/me                   The information from user\n');
  res.write('/api/registration              Introduce info for first time from user\n');
  res.write('/api/login                     User sign in\n')
  res.write('api/logout                     User sign out\n')
  res.write('')
  res.end();
});


/// ROUTE 01: /api/veterinary                     return "Array de veterinarias (JSON)"

server.get("/api/veterinary", (req, res) => {
  Veterinary.find(req.query, (err, result) => {
    if (err) console.log(err);
    res.json(result);
  });
});


/// ROUTE 02: /api/veterinary/:internalId           return "1 vet object"

server.get("/api/veterinary/:internalId", (req, res) => { 
  Veterinary.find({ internalId: req.params.internalId }, (err, result) => {
    if (err) console.log(err);
    res.json(result[0]);
  });
});


//  ROUTE 03: /api/registration                    SIGN UP

server.post('/api/registration', (req, res) => {
  const user = req.body;
  user.hash = sha1(user.password + salt);
  delete user.password;

  User.insertOne(user, (err, results) => {
    if (err) {
      console.log(err);
      res.status(500).send('An error occured in the registration');
    } else {
      res.json(results)
      res.sendStatus(200);
    }
  });
  res.send('User created' + JSON.stringify(req.body))
})


/// ROUTE 04: /api/user/me                           return our user    

server.get('/api/user/me', passport.authenticate('jwt', {session: false}), (req, res) => {
  console.log('jwt extracted', req.user)  
  
  User.find({objectId: req.user}, (err, result) => {
      if (err) console.log(err);
      res.json(result[0]);
  });
});


// ROUTE 05:  /api/login                          SIGN IN 

server.post('/api/login', (req, res, next)=> {
  console.log("login starting", req.body);

  passport.authenticate('local', {session:false}, (err, user, info) => {
    console.log('Finish authentication, generating jwt');
    if (err || !user) return res.sendStatus(401);
    
    jwt.sign({user}, secret, (err, token) => {
      console.log('jwt generated', err, token)
      
      if (err) return res.status(500).json(err);
      res.cookie('jwt', token, {
        httpOnly: true,
      }).send()
      res.json({jwt:token})
    })
  })(req,res,next);
})

 
// ROUTE 06: /api/logout                         SIGN OUT

server.post('/api/logout', (req, res, next)=> {
  res.clearCookie('jwt').send();
})



server.listen(port, function() {
  console.log("Listening on port " + port);
});
