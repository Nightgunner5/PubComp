import SourceRcon
import socket

server = SourceRcon.SourceRcon('192.168.1.4', 27015, 'ggbutton')
try:
    print server.rcon('sm plugins unload pubcomp')
    print server.rcon('sm plugins load pubcomp')
except socket.timeout:
    print 'Could not contact TF2.'

