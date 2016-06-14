# Matrix Blog
A js-script for matrix js api that will make a simple blog view of a matrix room.
It logs into the room as a guest so the room needs to be publicly viewable.

## Prerequisites
* Join/create the room you want to show in the blog with this user.
* Set it publicly viewable. "Who can read history?" -> Anyone
* Update index.html with the info.

## Setup
```
var blog = new MatrixBlog({
    selector: '#chat',
    room: '#blog:my.host.com',
    homeServer: 'https://my.host.com:8448'
});
```

## Matrix
An [open standard](http://matrix.org/docs/spec/) open standard for decentralised persistent communication.
